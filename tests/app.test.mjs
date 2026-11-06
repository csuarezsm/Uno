// Pruebas automáticas de la app UNO (IT Canarias): interfaz en móvil, horizontal y tablet, partida completa contra la máquina,
// modo aprendizaje, copia de seguridad y juego en línea contra una copia local del servidor común.
// Se ejecutan en GitHub antes de compilar: si alguna falla, no se publica la versión.
// Uso local: node tests/app.test.mjs   (para la parte en línea busca el servidor en ../juegos-servidor o en JUEGOS_SERVIDOR)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let passed = 0, failed = 0;
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); } };

const ROOT = fileURLToPath(new URL('../www/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const f = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' }); res.end(f); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_APP = `http://localhost:${server.address().port}/`;
let browser;
try { browser = await chromium.launch(); } catch (e) { browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' }); }
const BASE_STATE = { onboarded: true, iosHint: true, speed: 'turbo' };

async function fresh(state, viewport, online = '') {
  const ctx = await browser.newContext({ viewport: viewport || { width: 412, height: 860 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('https://api.github.com/**', r => r.abort());
  await ctx.route('https://csuarezsm.github.io/**', r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(u => { window.UNO_ONLINE_URL = u; }, online);        // en las pruebas, nunca el servidor real
  await p.addInitScript(st => { if (st && !sessionStorage.getItem('seeded')) { localStorage.setItem('uno.v1', JSON.stringify(st)); sessionStorage.setItem('seeded', '1'); } }, state || BASE_STATE);
  await p.goto(URL_APP);
  return { p, ctx, errors };
}
const waitFor = (p, fn, arg, timeout = 15000) => p.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// Juega como una persona usando solo los botones: carta jugable al azar, elige colores y objetivos, dice UNO, roba, pasa y pulsa «Siguiente mano»
async function paso(p, { uno = 0.7, pilla = 0.5, reta = 0.5 } = {}) {
  const T = { timeout: 1500 };
  const e = await p.evaluate(() => {
    const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
    return { next: !!q('#unNext:not([disabled])'), pcc: qa('[data-pcc]').length, pc: qa('[data-pc]').length, po: qa('[data-po]').length,
      go: !!q('.gstatus.go'), ok: qa('.hc.ok').map(b => +b.dataset.c), retar: !!q('#aRetar'), take: !!q('#aTake:not([disabled])'), pass: !!q('#aPass:not([disabled])'),
      unoBtn: !!q('#aUno:not(.on)'), unoNow: !!q('#aUnoNow'), pill: !!q('#aPill') };
  });
  try {
    if (e.next) { await p.click('#unNext', T); return; }
    if (e.pill && Math.random() < pilla) { await p.click('#aPill', T); return; }
    if (e.unoNow) { await p.click('#aUnoNow', T); return; }
    if (!e.go) return;
    if (e.pcc) { await p.click(`[data-pcc="${Math.floor(Math.random() * 4)}"]`, T); return; }
    if (e.pc) { await p.click(`[data-pc="${Math.floor(Math.random() * 4)}"]`, T); return; }
    if (e.po) { await p.click('[data-po]', T); return; }
    if (e.retar && Math.random() < reta) { await p.click('#aRetar', T); return; }
    if (e.ok.length && !e.retar) {
      if (e.unoBtn && Math.random() < uno) { await p.click('#aUno', T); }
      await p.click(`.hc.ok[data-c="${e.ok[Math.floor(Math.random() * e.ok.length)]}"]`, T); return;
    }
    if (e.take) { await p.click('#aTake', T); return; }
    if (e.pass) { await p.click('#aPass', T); return; }
  } catch (err) { /* la mesa cambió justo antes de pulsar: se vuelve a mirar */ }
}
async function jugarHasta(p, fin, { limite = 150000, ...o } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < limite) {
    if (await p.evaluate(fin)) return true;
    await paso(p, o);
    await p.waitForTimeout(25);
  }
  return false;
}
async function esperaTurno(p, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await p.$('.gstatus.go')) return true;
    if (await p.$('#unNext:not([disabled])')) await p.click('#unNext', { timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(40);
  }
  return false;
}
const G = p => p.evaluate(() => JSON.parse(localStorage.getItem('uno.v1')).game);
// Prepara una situación concreta en la mesa (me toca a mí) y la dibuja
const montar = (p, f) => p.evaluate(src => { const g = S.game.st; clearTimeout(AIT); g.turno = 0; g.fase = 'jugando'; g.pend = null; g.drawn = null; g.eligeColor = false; g.expuesto = null; g.cierre = null; new Function('g', 'U', src)(g, window.Uno); render(); clearTimeout(AIT); }, f);
const C = (c, t) => c * 16 + t;
const DEF = (o = {}) => ({ ...BASE_STATE, draft: { mode: 'ai', ai: { name: 'Carlos', rivals: 3, level: 2, learn: false, meta: 500, acum: false, siete0: false, penal: 4, ...o } } });

/* ================= Pantalla de inicio ================= */
console.log('Pantalla de inicio');
{
  const { p, ctx, errors } = await fresh(null, null, 'ws://127.0.0.1:9/ws');
  check('abre en «Contra la máquina» con los ajustes', await waitFor(p, () => document.querySelector('#aiStart') && document.querySelector('#aiLearn') && document.querySelector('#aiAcum') && document.querySelector('#aiSiete') && document.querySelectorAll('[data-opt="rivals"] button').length === 9));
  check('título UNO', (await p.textContent('#title')).includes('UNO'));
  check('el tema por defecto es «noche»', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#121c27' || document.documentElement.style.getPropertyValue('--bg') === '#121c27'));
  check('sin desbordamiento horizontal', await noHScroll(p));
  check('hay pestaña «En línea con amigos»', (await p.textContent('.modes')).includes('En línea'));
  await p.click('[data-opt="rivals"] button[data-v="5"]'); await p.click('[data-lvl="3"]'); await p.click('[data-opt="meta"] button[data-v="200"]'); await p.click('#aiAcum'); await p.click('[data-opt="aipenal"] button[data-v="2"]');
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('uno.v1')).draft.ai);
  check('recuerda rivales, nivel, meta, acumular y castigo', d.rivals === 5 && d.level === 3 && d.meta === 200 && d.acum === true && d.penal === 2, JSON.stringify(d));
  await p.click('#menuBtn');
  check('el menú tiene historial, reglas y cartas', await waitFor(p, () => ['mArch', 'mGameRules', 'mHands', 'mTheme', 'mWipe', 'mShareApp', 'mMas'].every(i => document.getElementById(i))));
  await p.click('#mGameRules');
  check('las reglas citan a Mattel y explican el UNO', /Mattel/.test(await p.textContent('.sheet')) && /pilla/i.test(await p.textContent('.sheet')) && !!(await p.$('#grHands')));
  await p.click('#grHands');
  check('«qué hace cada carta» lista las cartas y los puntos', await waitFor(p, () => document.querySelectorAll('.sheet .hrow').length === 7));
  await p.click('#hOk');
  await p.click('#menuBtn'); await p.click('#mTheme');
  await p.click('[data-theme="claro"]');
  check('cambiar el tema se aplica al momento', await waitFor(p, () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#f1eee6'));
  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { p, ctx } = await fresh({ iosHint: true });
  check('la primera vez sale la bienvenida', await waitFor(p, () => document.querySelector('#wbNext')));
  for (let k = 0; k < 4; k++) await p.click('#wbNext');
  await p.click('#wbNext');
  check('la bienvenida se cierra y no vuelve', await waitFor(p, () => document.querySelector('#modal').classList.contains('hidden')) && (await p.evaluate(() => JSON.parse(localStorage.getItem('uno.v1')).onboarded)));
  await ctx.close();
}

/* ================= Partida completa contra la máquina ================= */
console.log('Partida contra la máquina');
for (const [rivals, level, extra] of [[2, 1, { meta: 0 }], [3, 2, { meta: 200, acum: true, siete0: true, learn: true }], [5, 3, { meta: 0, penal: 2 }]]) {
  const { p, ctx, errors } = await fresh(DEF({ rivals, level, ...extra }));
  await p.click('#aiStart');
  check(`mesa de ${rivals + 1}: rivales, descarte, mazo y 7 cartas`, await waitFor(p, n => document.querySelectorAll('.opp').length === n && document.querySelectorAll('.un-hand .hc').length >= 7 && document.querySelector('.un-disc .uc') && document.querySelector('#unDraw'), rivals));
  check('las cartas de los rivales están tapadas', await p.evaluate(() => [...document.querySelectorAll('.opp .uc')].every(c => c.classList.contains('back'))));
  check('mis cartas se ven (no hay ninguna tapada)', await p.evaluate(() => [...document.querySelectorAll('.un-hand .uc')].every(c => !c.classList.contains('back'))));
  check('sin desbordamiento horizontal con la mesa', await noHScroll(p));
  const n = rivals + 1;
  const ok = await jugarHasta(p, () => !!document.querySelector('.un .gstatus.end'), { limite: 170000 });
  check(`la partida de ${n} termina`, ok);
  if (ok) {
    const r = await p.evaluate(() => {
      const S = JSON.parse(localStorage.getItem('uno.v1')), g = S.game.st;
      return { filas: document.querySelectorAll('.un .on-seat').length, arch: S.archive.length, a: S.archive[0], total: g.mazo.length + g.desc.length + g.seats.reduce((t, x) => t + x.mano.length, 0), meta: g.cfg.meta, puntos: g.seats.map(x => x.puntos), orden: g.orden };
    });
    check('la clasificación final lista a todos', r.filas === n, r.filas + ' de ' + n);
    check('la partida se guarda en el historial', r.arch === 1 && r.a.n === n && r.a.orden.length === n && r.a.place >= 1 && r.a.place <= n && r.a.mode === 'ai' && r.a.meta === r.meta);
    check('no se pierde ni se inventa ninguna carta (108)', r.total === 108, String(r.total));
    if (r.meta) check('quien gana ha llegado a la meta', r.puntos[r.orden[0]] >= r.meta, JSON.stringify(r.puntos));
    await p.click('#menuBtn'); await p.click('#mArch');
    check('el historial muestra estadísticas y la fila', await waitFor(p, () => document.querySelector('.stat4') && document.querySelectorAll('.sheet .hrow').length >= 1));
    await p.click('#arOk');
  }
  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= Modo aprendizaje ================= */
console.log('Modo aprendizaje');
{
  const { p, ctx, errors } = await fresh(DEF({ learn: true }));
  await p.click('#aiStart');
  check('con el modo activado sale el panel con tu mano', await waitFor(p, () => document.querySelector('.un-learn') && /Tu mano/.test(document.querySelector('.un-learn').textContent)));
  check('espera tu turno', await esperaTurno(p));
  check('hay un botón «¿Qué hago?»', !!(await p.$('#unAdvice')));
  await p.click('#unAdvice');
  check('muestra el consejo explicado', await waitFor(p, () => { const a = document.querySelector('.un-learn .adv'); return a && a.textContent.length > 50; }));
  check('marca la carta o el botón recomendado', await waitFor(p, () => !!document.querySelector('.hc.sug, .un-act .sug')));
  const n0 = (await G(p)).st.ultimo.n;
  await p.waitForTimeout(1500);
  check('el consejo nunca juega por ti: la partida espera', (await G(p)).st.ultimo.n === n0);
  await p.click('#unLearn', { force: true });
  check('se puede apagar en cualquier momento', await waitFor(p, () => !document.querySelector('.un-learn')));
  await p.click('#unLearn', { force: true });
  check('y volver a encender', await waitFor(p, () => !!document.querySelector('.un-learn')));
  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= Las jugadas, una a una ================= */
console.log('Jugadas');
{
  const { p, ctx, errors } = await fresh(DEF({ rivals: 3, siete0: true, meta: 500 }));
  await p.click('#aiStart');
  await waitFor(p, () => document.querySelector('.un-hand .hc'));
  const R = 0, A = 1, V = 2, Z = 3;
  // 1) una carta que no coincide avisa y no se juega
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(Z, 3)}, ${C(R, 4)}, ${C(V, 8)}];`);
  check('las cartas jugables se marcan y las demás se apagan', await p.evaluate(() => document.querySelectorAll('.hc.ok').length === 1 && document.querySelectorAll('.hc.no').length === 2));
  await p.click(`.hc[data-c="${C(Z, 3)}"]`);
  check('una carta que no coincide avisa y no se juega', await waitFor(p, () => /No coincide/.test(document.getElementById('toast').textContent)) && (await G(p)).st.seats[0].mano.length === 3);
  // 2) un comodín pide el color
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(4, 13)}, ${C(Z, 3)}, ${C(V, 8)}];`);
  await p.click(`.hc[data-c="${C(4, 13)}"]`);
  check('al jugar un comodín pide elegir el color', await waitFor(p, () => document.querySelectorAll('[data-pc]').length === 4));
  await p.click('[data-pc="2"]');
  const g1 = (await G(p)).st;
  check('el comodín se juega con el color elegido', g1.top === C(4, 13) && g1.color === 2 && g1.seats[0].mano.length === 2);
  // 3) un 7 con la regla activada pide con quién cambiar
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(R, 7)}, ${C(Z, 3)}, ${C(V, 8)}]; g.seats[2].mano = [${C(A, 1)}, ${C(A, 2)}];`);
  await p.click(`.hc[data-c="${C(R, 7)}"]`);
  check('el 7 pide con quién cambiar la mano', await waitFor(p, () => document.querySelectorAll('[data-po]').length === 3));
  await p.click('[data-po="2"]');
  const g2 = (await G(p)).st;
  check('cambia mi mano por la del elegido', JSON.stringify(g2.seats[0].mano.slice().sort()) === JSON.stringify([C(A, 1), C(A, 2)]) && g2.seats[2].mano.length === 2);
  // 4) decir UNO antes de jugar la penúltima carta
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.cfg.siete0 = false; g.seats[0].mano = [${C(R, 3)}, ${C(Z, 5)}]; g.seats[0].dec = false;`);
  check('con dos cartas sale el botón ¡UNO!', !!(await p.$('#aUno')));
  await p.click('#aUno');
  check('queda marcado como dicho', await waitFor(p, () => /dicho/.test(document.querySelector('#aUno').textContent)));
  await p.click(`.hc[data-c="${C(R, 3)}"]`);
  const g3 = (await G(p)).st;
  check('jugar tras decir UNO te deja a salvo (no te pueden pillar)', g3.seats[0].mano.length === 1 && g3.seats[0].dec === true && g3.expuesto === null);
  // 5) olvidar el UNO: te pueden pillar, y puedes decirlo a tiempo
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(R, 3)}, ${C(Z, 5)}]; g.seats[0].dec = false;`);
  await p.click(`.hc[data-c="${C(R, 3)}"]`);
  check('sin decir UNO quedas expuesto y sale el botón para decirlo', await waitFor(p, () => document.querySelector('#aUnoNow') || (JSON.parse(localStorage.getItem('uno.v1')).game.st.expuesto === null)));
  // 6) pillar a otro
  await p.evaluate(() => { clearTimeout(AIT); const g = S.game.st; g.fase = 'jugando'; g.turno = 0; g.eligeColor = false; g.pend = null; g.drawn = null; g.seats[0].mano = [16 * 0 + 3, 16 * 3 + 5, 16 * 2 + 2]; g.seats[1].mano = [16 * 2 + 4]; g.seats[1].dec = false; g.expuesto = { i: 1 }; render(); clearTimeout(AIT); });
  check('si otro olvida el UNO sale «¡Pillar!»', !!(await p.$('#aPill')));
  await p.click('#aPill');
  const g5 = (await G(p)).st;
  check('pillar le hace robar el castigo (4)', g5.seats[1].mano.length === 5 && g5.expuesto === null);
  // 7) castigo de +4 y desafío
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(Z, 3)}, ${C(V, 8)}]; g.pend = { n: 4, tipo: 'd4', retable: true, culpable: false, de: 3, antes: ${R} };`);
  check('ante un +4 sale «Desafiar» y «Robar 4»', !!(await p.$('#aRetar')) && /Robar 4/.test(await p.textContent('#aTake')));
  await p.click('#aTake');
  check('robar el castigo suma las cartas y pasa el turno', (await G(p)).st.seats[0].mano.length === 6);
  // 8) robar y jugar la carta robada / pasar
  await montar(p, `g.top = ${C(R, 9)}; g.color = ${R}; g.seats[0].mano = [${C(Z, 3)}, ${C(V, 8)}]; g.mazo.push(${C(R, 6)});`);
  await p.click('#unDraw');
  check('robar una carta que sirve permite jugarla o pasar', await waitFor(p, () => document.querySelector('#aPass') && document.querySelectorAll('.hc.ok').length === 1));
  await p.click('#aPass');
  check('pasar termina el turno', await waitFor(p, () => !document.querySelector('.gstatus.go')) || (await G(p)).st.turno !== 0);
  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= Acumular y reglas de la mesa ================= */
console.log('Acumular');
{
  const { p, ctx, errors } = await fresh(DEF({ rivals: 3, acum: true }));
  await p.click('#aiStart');
  await waitFor(p, () => document.querySelector('.un-hand .hc'));
  await montar(p, `g.top = ${C(0, 12)}; g.color = 0; g.seats[0].mano = [${C(3, 12)}, ${C(2, 8)}, ${C(1, 3)}]; g.pend = { n: 2, tipo: 'd2', retable: false, culpable: false, de: 3 };`);
  check('con un +2 delante y otro en la mano, se puede devolver', await p.evaluate(() => document.querySelectorAll('.hc.ok').length === 1 && /Robar 2/.test(document.querySelector('#aTake').textContent)));
  await p.click(`.hc[data-c="${C(3, 12)}"]`);
  const g = (await G(p)).st;
  check('el castigo suma 4 y pasa al siguiente', g.pend && g.pend.n === 4 && g.seats[0].mano.length === 2);
  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= Continuar y copias ================= */
console.log('Partida guardada y copia de seguridad');
{
  const { p, ctx } = await fresh(DEF({ rivals: 3, meta: 500 }));
  await p.click('#aiStart');
  await esperaTurno(p);
  const antes = await G(p);
  await p.reload();
  check('al reabrir sigue la misma partida', await waitFor(p, id => document.querySelector('.un') && JSON.parse(localStorage.getItem('uno.v1')).game.id === id, antes.id));
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('uno.v1')); S.game.st.seats = 'roto'; localStorage.setItem('uno.v1', JSON.stringify(S)); });
  await p.reload();
  check('una partida guardada dañada se descarta sin romper', await waitFor(p, () => document.querySelector('#aiStart')));
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('uno.v1')); S.archive = [{ id: 'abc', created: 1, finished: 2, mode: 'ai', level: 2, n: 3, nombres: ['A', 'B', 'C'], bots: [false, true, true], orden: [1, 0, 2], yo: 0, place: 2, manos: 6, meta: 500 }]; localStorage.setItem('uno.v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#menuBtn'); await p.click('#mArch');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#arBk')]);
  const f = await dl.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  check('la copia lleva el historial', j.app === 'uno' && j.archive.length === 1 && j.archive[0].id === 'abc');
  await p.click('#arOk');
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('uno.v1')); S.archive = []; localStorage.setItem('uno.v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#menuBtn');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#mImp')]);
  await fc.setFiles(f);
  await p.click('#cOk');
  check('importar la copia recupera el historial', await waitFor(p, () => JSON.parse(localStorage.getItem('uno.v1')).archive.length === 1 && JSON.parse(localStorage.getItem('uno.v1')).archive[0].meta === 500));
  const malo = '/tmp/uno-malo.json'; fs.writeFileSync(malo, JSON.stringify({ app: 'uno', archive: [{ id: '<img>', n: 99 }, { id: 'ok', n: 2, nombres: ['x', 'y'], orden: [0, 0] }] }));
  await p.click('#menuBtn');
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#mImp')]);
  await fc2.setFiles(malo); await p.waitForTimeout(200);
  check('una copia con datos inválidos no mete nada', /0 partidas/.test(await p.textContent('.sheet')));
  await p.click('#cNo');
  await ctx.close();
}

/* ================= Móvil horizontal, tablet y mesa de 10 ================= */
console.log('Pantallas');
for (const [nombre, vp] of [['móvil horizontal', { width: 844, height: 390 }], ['tablet', { width: 820, height: 1180 }], ['móvil pequeño', { width: 360, height: 640 }]]) {
  const { p, ctx, errors } = await fresh(DEF({ rivals: 9, level: 1, learn: true }), vp);
  await p.click('#aiStart');
  const ok = await waitFor(p, () => document.querySelectorAll('.opp').length === 9 && document.querySelectorAll('.un-hand .hc').length >= 7);
  check(`${nombre}: mesa de 10 jugadores`, ok);
  check(`${nombre}: sin desbordamiento horizontal`, await noHScroll(p));
  await esperaTurno(p);
  const vis = await p.evaluate(() => { const b = document.querySelector('.hc'); if (!b) return false; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return r.width > 30 && r.height > 40 && r.left >= 0 && r.right <= window.innerWidth; });
  check(`${nombre}: las cartas caben y se alcanzan`, vis);
  check(`${nombre}: sin errores de JavaScript`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ================= En línea (contra una copia local del servidor común) ================= */
console.log('En línea');
{
  const SERV = process.env.JUEGOS_SERVIDOR || fileURLToPath(new URL('../../juegos-servidor/', import.meta.url));
  let serverOk = false, crearServidor, PS;
  if (fs.existsSync(join(SERV, 'src/juegos/uno.js'))) {
    try {
      Object.assign(process.env, { PASO_BOT_MS: '5', SEGUIR_MS: '150', AUSENTE_MS: '600', UNO_RITMO_MS: '', LIMITE_MSG: '20000', DATA_DIR: fs.mkdtempSync(join(process.env.TMPDIR || '/tmp', 'juegos-')) });
      const cr = createRequire(join(SERV, 'package.json'));
      ({ crearServidor } = cr('./src/server.js'));
      serverOk = true;
    } catch (e) { console.log('  (no se pudo cargar el servidor: ' + e.message + ')'); }
  } else console.log('  ⚠ El servidor común todavía no tiene el UNO (src/juegos/uno.js): se omite la parte en línea. Sube antes el servidor y vuelve a ejecutar.');
  if (serverOk) {
    const { server: PSrv } = crearServidor(); PS = PSrv;
    await new Promise(r => PS.listen(0, '127.0.0.1', r));
    const WS = `ws://127.0.0.1:${PS.address().port}/ws`;
    const A = await fresh({ ...BASE_STATE, online: { nombre: 'Carlos', token: 'a'.repeat(18) } }, null, WS);
    const B = await fresh({ ...BASE_STATE, online: { nombre: 'Mari', token: 'b'.repeat(18) } }, { width: 390, height: 844 }, WS);
    await A.p.click('[data-mode="online"]');
    check('la pestaña en línea conecta', await waitFor(A.p, () => /Conectado/.test(document.body.textContent)));
    await A.p.click('[data-opt="meta"] button[data-v="0"]'); await A.p.click('#onAcum'); await A.p.click('[data-opt="ritmo"] button[data-v="relajado"]');
    await A.p.click('#onCreate');
    check('se crea la mesa y sale el código', await waitFor(A.p, () => document.querySelector('.on-code')));
    const code = await A.p.textContent('.on-code');
    check('el código tiene 4 caracteres', /^[A-Z0-9]{4}$/.test(code.trim()));
    check('la sala muestra las opciones elegidas', /Una mano.*acumula.*60 s/.test(await A.p.textContent('.sec')));
    await B.p.click('[data-mode="online"]');
    await waitFor(B.p, () => /Conectado/.test(document.body.textContent));
    await B.p.fill('#onCode', code.trim()); await B.p.click('#onJoin');
    check('el segundo jugador entra', await waitFor(A.p, () => document.querySelectorAll('.on-seat').length === 2));
    await A.p.click('#onBot');
    check('se añade a la máquina', await waitFor(A.p, () => document.querySelectorAll('.on-seat').length === 3));
    await A.p.click('#onStart');
    check('empieza la partida en los dos móviles', await waitFor(A.p, () => document.querySelector('.un-mid')) && await waitFor(B.p, () => document.querySelector('.un-mid')));
    const solo = p => p.evaluate(() => document.querySelectorAll('.un-hand .hc').length >= 7 && [...document.querySelectorAll('.opp .uc')].every(c => c.classList.contains('back')) && [...document.querySelectorAll('.un-hand .uc')].every(c => !c.classList.contains('back')));
    check('cada uno ve solo sus cartas', await solo(A.p) && await solo(B.p));
    check('el servidor manda el reloj del turno', await waitFor(A.p, () => /Te toca|Juega|Robar|Elige/.test(document.querySelector('.gstatus').textContent)));
    const fin = () => !!document.querySelector('.un .gstatus.end');
    const [okA, okB] = await Promise.all([jugarHasta(A.p, fin, { limite: 180000 }), jugarHasta(B.p, fin, { limite: 180000 })]);
    check('la partida en línea termina para los dos', okA && okB);
    if (okA && okB) {
      check('los dos ven la misma clasificación', await A.p.evaluate(() => document.querySelectorAll('.un .on-seat').length === 3) && await B.p.evaluate(() => document.querySelectorAll('.un .on-seat').length === 3));
      check('la partida se guarda en el historial de cada uno', await A.p.evaluate(() => JSON.parse(localStorage.getItem('uno.v1')).archive.some(a => a.mode === 'online' && a.n === 3)) && await B.p.evaluate(() => JSON.parse(localStorage.getItem('uno.v1')).archive.some(a => a.mode === 'online')));
      check('hay botón de revancha', !!(await A.p.$('#onRe')));
      await A.p.click('#onRe'); await B.p.click('#onRe');
      check('la revancha reparte otra partida', await waitFor(A.p, () => document.querySelector('.un-mid') && !document.querySelector('.un .gstatus.end')));
    }
    check('sin errores de JavaScript (Carlos)', A.errors.length === 0, A.errors.join(' | '));
    check('sin errores de JavaScript (Mari)', B.errors.length === 0, B.errors.join(' | '));
    await A.ctx.close(); await B.ctx.close(); PS.close();
  }
}

await browser.close(); server.close();
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
