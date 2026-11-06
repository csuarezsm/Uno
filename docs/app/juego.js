/* UNO — contra la máquina y en línea, con modo aprendizaje (IT Canarias)
   © 2026 IT Canarias. Todos los derechos reservados. */
'use strict';
const U = window.Uno;
const LEVELS = { 1: { name: 'Fácil', desc: 'Juega al azar, a veces olvida decir UNO y casi nunca te pilla.' },
  2: { name: 'Normal', desc: 'Guarda los comodines, se fija en tu mano y a veces te pilla.' },
  3: { name: 'Difícil', desc: 'Cuenta colores, ataca cuando te quedas con pocas cartas y casi siempre te pilla.' } };
const BOT_IDEAS = ['Pancho', 'Chano', 'Candelaria', 'Tomasa', 'Juanillo', 'Nieves', 'Pepito', 'Carmela', 'Domingo', 'Fefa', 'Agustín', 'Chona', 'Ramón', 'Pino', 'Chicho', 'Luci'];
const SPEEDS = { normal: { bot: 1000, fin: 1200 }, rapida: { bot: 450, fin: 600 }, turbo: { bot: 30, fin: 30 } };   // «turbo» solo lo usan las pruebas
const speed = () => SPEEDS[S.speed] || SPEEDS.normal;
// Servidor de juegos en línea (repo csuarezsm/juegos-servidor). Vacío = la opción «En línea» no aparece.
const ONLINE_URL = 'UNO_ONLINE_URL' in window ? window.UNO_ONLINE_URL : 'wss://juegos.itcanarias.com/ws';
const METAS = [500, 200, 1000, 0];
const metaTxt = m => m === 0 ? 'Una mano' : m + ' puntos';
const botName = name => String(name || '').replace(/^🤖\s*/, '');
const CN = ['Rojo', 'Amarillo', 'Verde', 'Azul'], CL = ['R', 'A', 'V', 'Az'];

/* ================= Sonidos (sintetizados: sin archivos de audio) ================= */
const Sound = (() => {
  let ctx = null;
  const ac = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const out = c => (window.AudioSuave ? AudioSuave.salida(c) : c.destination);
  function knock(c, t, freq, vol, dur) {
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(out(c)); src.start(t);
  }
  function tone(c, t, freq, dur, vol, type) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out(c)); o.start(t); o.stop(t + dur + 0.02);
  }
  function play(kind) {
    if (S.sound === false) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + 0.01;
    try {
      if (kind === 'deal') { for (let k = 0; k < 3; k++) knock(c, t + k * 0.08, 2200, 0.3, 0.03); }
      else if (kind === 'card') { knock(c, t, 1500, 0.5, 0.05); }
      else if (kind === 'draw') { knock(c, t, 2600, 0.35, 0.04); knock(c, t + 0.07, 2300, 0.3, 0.04); }
      else if (kind === 'uno') { tone(c, t, 660, 0.18, 0.08, 'triangle'); tone(c, t + 0.12, 880, 0.3, 0.08, 'triangle'); }
      else if (kind === 'pillar') { tone(c, t, 300, 0.15, 0.08, 'square'); tone(c, t + 0.14, 220, 0.3, 0.08, 'square'); }
      else if (kind === 'win') { [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.12, f, 0.45, 0.07, 'sine')); }
      else if (kind === 'lose') tone(c, t, 220, 0.28, 0.06, 'sine');
      else if (kind === 'end') { [523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * 0.13, f, 0.55, 0.07, 'sine')); }
    } catch (e) {}
  }
  return { play };
})();

/* ================= Cartas y textos ================= */
const SIM = { 10: '⊘', 11: '⇄', 12: '+2', 13: '★', 14: '+4' };
const simb = c => { const t = U.tp(c); return t <= 9 ? String(t) : SIM[t]; };
function cardHtml(c, cls) {
  if (c == null || c < 0) return `<i class="uc back ${cls || ''}"><b>UNO</b></i>`;
  const co = U.col(c), s = simb(c);
  return `<i class="uc c${co} ${cls || ''}" aria-label="${esc(U.nombreCarta(c))}"><u>${s}</u><b>${s}</b>${co < 4 ? `<em>${CL[co]}</em>` : ''}</i>`;
}
const nm = (vm, i) => botName(vm.seats[i].nombre) || ('Jugador ' + (i + 1));
const quien = (vm, i, tu, el) => vm.yo === i ? tu : el.replace('%', nm(vm, i));
function describe(vm, u) {
  if (!u || !u.tipo) return '';
  const y = vm.yo, n = i => i === y ? 'Tú' : nm(vm, i);
  switch (u.tipo) {
    case 'inicio': {
      const c = U.nombreCarta(u.carta);
      if (u.efecto === 'salta') return `Carta inicial: ${c}. ${n(u.i)} ${u.i === y ? 'pierdes' : 'pierde'} el turno.`;
      if (u.efecto === 'sentido') return `Carta inicial: ${c}. Se cambia el sentido.`;
      if (u.efecto === 'roba') return `Carta inicial: ${c}. ${n(u.i)} ${u.i === y ? 'robas 2 y pierdes' : 'roba 2 y pierde'} el turno.`;
      if (u.efecto === 'color') return `Carta inicial: ${c}. ${u.i === y ? 'Eliges' : nm(vm, u.i) + ' elige'} el color.`;
      return 'Carta inicial: ' + c + '.';
    }
    case 'jugar': {
      let t = `${n(u.i)} ${u.i === y ? 'juegas' : 'juega'} ${U.nombreCarta(u.carta)}`;
      if (U.esComodin(u.carta)) t += ` y ${u.i === y ? 'eliges' : 'elige'} ${CN[u.color].toLowerCase()}`;
      if (u.salta != null) t += `. ${n(u.salta)} ${u.salta === y ? 'pierdes' : 'pierde'} el turno`;
      if (u.sentido) t += '. Cambia el sentido';
      if (u.roba != null) t += `. ${n(u.roba)} ${u.roba === y ? 'robas' : 'roba'} ${u.cantidad}`;
      if (u.castigo) t += `. Castigo de ${u.castigo}`;
      if (u.cambia != null) t += `. Cambia la mano con ${n(u.cambia)}`;
      if (u.rota) t += '. Todos pasan su mano';
      return t;
    }
    case 'robar': return `${n(u.i)} ${u.i === y ? 'robas' : 'roba'} ${u.cantidad === 1 ? 'una carta' : u.cantidad + ' cartas'}`;
    case 'pasar': return `${n(u.i)} ${u.i === y ? 'pasas' : 'pasa'}`;
    case 'color': return `${n(u.i)} ${u.i === y ? 'eliges' : 'elige'} ${CN[u.color].toLowerCase()}`;
    case 'uno': return `¡${n(u.i)} ${u.i === y ? 'dices' : 'dice'} UNO!`;
    case 'pillar': return `¡${n(u.i)} ${u.i === y ? 'pillas' : 'pilla'} a ${n(u.obj)}! ${u.obj === y ? 'Robas' : 'Roba'} ${u.cantidad}`;
    case 'retar': return u.ok ? `${n(u.i)} ${u.i === y ? 'desafías' : 'desafía'} a ${n(u.obj)} y gana: ${n(u.obj)} ${u.obj === y ? 'robas' : 'roba'} ${u.cantidad}` : `${n(u.i)} ${u.i === y ? 'desafías' : 'desafía'} a ${n(u.obj)} y pierde: ${u.i === y ? 'robas' : 'roba'} ${u.cantidad}`;
  }
  return '';
}
const colorBtns = attr => `<div class="un-cols">${[0, 1, 2, 3].map(k => `<button class="un-cb k${k}" data-${attr}="${k}">${CN[k]}</button>`).join('')}</div>`;

/* ================= Pantalla de inicio (contra la máquina) ================= */
function uniqueBots(n) { return BOT_IDEAS.slice().sort(() => Math.random() - 0.5).slice(0, n); }
function levelBtns(cur, attr) {
  return `<div class="levels">${[1, 2, 3].map(l => `<button class="lvl ${cur === l ? 'on' : ''}" data-${attr}="${l}"><b>${l}</b><span>${LEVELS[l].name}<em>${LEVELS[l].desc}</em></span></button>`).join('')}</div>`;
}
function modeTabs() {
  const ms = [['ai', '🤖 Contra la máquina']].concat(ONLINE_URL ? [['online', '🌐 En línea con amigos']] : []);
  return `<div class="kinds modes">${ms.map(([k, l]) => `<button data-mode="${k}" class="${S.draft.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function bindModeTabs() { document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { syncDraft(); S.draft.mode = b.dataset.mode; render(); }); }
const optBtns = (vals, cur, attr, lab) => `<span class="kinds" data-opt="${attr}" style="flex:none;width:62%;margin:0">${vals.map(v => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${lab ? lab(v) : v}</button>`).join('')}</span>`;
const rulesOpts = (o, p) => `
      <label class="f"><span>Acumular +2 y +4<em>Si te ponen un +2 (o +4) y tienes otro igual, se lo devuelves y suma. Con la regla oficial se roba y se pierde el turno.</em></span><input type="checkbox" class="tg" id="${p}Acum" ${o.acum ? 'checked' : ''}></label>
      <label class="f"><span>Regla del 7 y el 0<em>El 7 cambia tu mano por la de otro jugador; el 0 hace pasar todas las manos en el sentido del juego.</em></span><input type="checkbox" class="tg" id="${p}Siete" ${o.siete0 ? 'checked' : ''}></label>
      <label class="f"><span>Si no dices UNO y te pillan<em>Cartas que robas</em></span>${optBtns([4, 2], o.penal, p + 'penal', v => v + ' cartas')}</label>`;
function syncDraft() {
  const d = S.draft.ai, el = $('#aiName'); if (el) { d.name = cleanName(el.value).slice(0, 18); if (d.name) S.lastName = d.name; }
  const lr = $('#aiLearn'); if (lr) d.learn = lr.checked;
  const a = $('#aiAcum'); if (a) d.acum = a.checked;
  const s7 = $('#aiSiete'); if (s7) d.siete0 = s7.checked;
  save();
}
function renderSetup() {
  if (S.draft.mode === 'online' && ONLINE_URL) return renderOnline();
  S.draft.mode = 'ai';
  $('#subtitle').textContent = 'Cartas de colores';
  const d = S.draft.ai;
  $('#app').innerHTML = `${modeTabs()}
    <div class="sec"><h2>Tu nombre</h2>
      <input id="aiName" maxlength="18" placeholder="Cómo te llamarás en la mesa" value="${esc(d.name || S.lastName || '')}" autocomplete="off" style="width:100%"></div>
    <div class="sec"><h2>Rivales</h2>
      <div class="kinds" data-opt="rivals" style="margin:0 0 6px">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-v="${n}" class="${d.rivals === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="mut" id="aiRivTxt"></div>
      <h2 style="margin-top:14px">Nivel de la máquina</h2>${levelBtns(d.level, 'lvl')}</div>
    <div class="sec"><h2>La partida</h2>
      <label class="f"><span>Se juega a<em>Gana quien llega primero a esos puntos sumando las cartas de los demás al terminar cada mano</em></span>${optBtns(METAS, d.meta, 'meta', metaTxt)}</label>
      ${rulesOpts(d, 'ai')}
      <label class="f"><span>💡 Modo aprendizaje<em>Te explica tus opciones, qué conviene jugar y por qué. Nunca juega por ti.</em></span><input type="checkbox" class="tg" id="aiLearn" ${d.learn ? 'checked' : ''}></label></div>
    <button class="btn-gold" id="aiStart" style="width:100%;padding:16px;font-size:calc(17px * var(--fs, 1))">Repartir 🃏</button>
    <div class="mut" style="text-align:center;margin:10px 0 24px">Reglas oficiales de UNO. Cada uno recibe 7 cartas; gana la mano quien se queda sin cartas.</div>`;
  bindModeTabs();
  const upd = () => { $('#aiRivTxt').textContent = `Mesa de ${d.rivals + 1} jugadores (tú y ${d.rivals} ${d.rivals === 1 ? 'rival' : 'rivales'}).`; };
  upd();
  const grp = (k, f) => document.querySelectorAll(`[data-opt="${k}"] button`).forEach(b => b.onclick = () => { f(+b.dataset.v); save(); document.querySelectorAll(`[data-opt="${k}"] button`).forEach(x => x.classList.toggle('on', x === b)); });
  grp('rivals', v => { d.rivals = v; upd(); });
  grp('meta', v => { d.meta = v; });
  grp('aipenal', v => { d.penal = v; });
  document.querySelectorAll('[data-lvl]').forEach(b => b.onclick = () => { syncDraft(); d.level = +b.dataset.lvl; save(); renderSetup(); });
  ['aiLearn', 'aiAcum', 'aiSiete'].forEach(id => $('#' + id).onchange = syncDraft);
  $('#aiStart').onclick = () => { syncDraft(); startAi(); };
}
function startAi() {
  const d = S.draft.ai;
  const nombres = [d.name || 'Tú'].concat(uniqueBots(d.rivals));
  const st = U.nueva({ nombres, bots: nombres.map((_, i) => i > 0), meta: d.meta, acum: d.acum, siete0: d.siete0, penal: d.penal });
  S.game = { id: uid(), created: Date.now(), mode: 'ai', level: d.level, learn: !!d.learn, st };
  LAST.key = null; LEARN.open = false; UNP.k = null; UNOF.on = false;
  Sound.play('deal');
  render(); keepAwake();
}

/* ================= La mesa (la misma para la partida local y la de en línea) ================= */
const LAST = { key: null };
const LEARN = { open: false, key: null, c: null };
const UNP = { k: null, carta: null };          // carta pendiente de elegir color o con quién cambiar
const UNOF = { on: false };                    // «¡UNO!» pulsado antes de jugar
let AIT = null;
const stateKey = vm => vm.ronda + '|' + vm.fase + '|' + (vm.ultimo ? vm.ultimo.n : 0);

function oppHtml(vm, i) {
  const s = vm.seats[i], turn = vm.turno === i;
  const uno = s.n === 1;
  const exp = vm.expuesto && vm.expuesto.i === i;
  const cls = ['opp', turn ? 'turn' : '', exp ? 'exp' : ''].join(' ');
  const fan = Math.min(s.n, 7);
  const cards = '<div class="ofan">' + Array.from({ length: fan }, () => '<i class="uc back sm"></i>').join('') + '</div>';
  return `<div class="${cls}"><div class="on">${s.bot ? '🤖 ' : ''}<span>${esc(botName(s.nombre))}</span></div>
    ${cards}
    <div class="ocnt"><b>${s.n}</b> ${s.n === 1 ? 'carta' : 'cartas'}${vm.cfg.meta ? ' · ' + s.puntos + ' pts' : ''}</div>
    ${uno ? (s.dec ? '<span class="unob ok">¡UNO!</span>' : '<span class="unob">sin decir UNO</span>') : ''}</div>`;
}
function statusInfo(vm, ctx) {
  if (vm.fase === 'fin') return { t: '🏆 Fin de la partida', cls: 'end' };
  if (vm.fase === 'ronda_fin') return { t: 'Fin de la mano ' + vm.ronda, cls: '' };
  if (ctx.mine) return { t: (vm.eligeColor ? 'Elige un color' : vm.pend ? 'Robar ' + vm.pend.n + (vm.cfg.acum ? ' o devolverlo' : '') : 'Te toca') + (ctx.timer ? ' · <span id="unTimer">' + ctx.timer + '</span>' : ''), cls: 'go' };
  if (vm.turno != null) return { t: 'Juega ' + esc(nm(vm, vm.turno)) + '…' + (ctx.timer ? ' · <span id="unTimer">' + ctx.timer + '</span>' : ''), cls: '' };
  return { t: '', cls: '' };
}
function tableHtml(vm, ctx) {
  const yo = vm.yo, me = yo != null && yo >= 0 ? vm.seats[yo] : null;
  const order = []; for (let k = 1; k < vm.n; k++) order.push(((yo == null || yo < 0 ? 0 : yo) + k) % vm.n);
  const S1 = statusInfo(vm, ctx), ended = vm.fase === 'fin';
  const L = me && ctx.mine ? U.legal(vm, yo) : null;
  const canDraw = !!(L && L.robar && !vm.pend && !UNP.k);
  const info = `<div class="un-info"><div class="dirb">${vm.dir === 1 ? '↻' : '↺'}</div><small>${vm.dir === 1 ? 'sentido horario' : 'sentido contrario'}</small>${vm.pend ? `<div class="pendb">+${vm.pend.n}</div>` : ''}</div>`;
  const mid = `<div class="un-mid">
      <button class="un-pile ${canDraw ? 'go' : ''}" id="unDraw" ${canDraw ? '' : 'disabled'} aria-label="Robar una carta">${cardHtml(-1, 'big')}<small>${vm.mazoN} cartas</small></button>
      <div class="un-disc"><div class="un-ring k${vm.color}">${cardHtml(vm.top, 'big pop')}</div><div class="un-colname"><i class="cdot k${vm.color}"></i> ${CN[vm.color]}</div></div>
      ${info}</div>`;
  const say = `<div class="un-say">${esc(describe(vm, vm.ultimo)) || '&nbsp;'}</div>`;
  const head = `<div class="un-top">Mano ${vm.ronda} · ${vm.cfg.meta ? 'a ' + vm.cfg.meta + ' puntos' : 'una sola mano'}${vm.cfg.acum ? ' · acumula' : ''}${vm.cfg.siete0 ? ' · 7-0' : ''}</div>`;
  const stH = `<div class="gstatus ${S1.cls}">${S1.t}</div>`;
  const oppsH = `<div class="un-opps">${order.map(i => oppHtml(vm, i)).join('')}</div>`;
  if (ended) return `<div class="un">${stH}${finHtml(vm, ctx)}</div>`;
  if (vm.fase === 'ronda_fin') return `<div class="un">${stH}${manoFinHtml(vm, ctx)}</div>`;
  return `<div class="un">${oppsH}${head}${mid}${say}${stH}${me ? actionHtml(vm, ctx, L) + handHtml(vm, ctx, L) : ''}
    ${ctx.learn && me ? learnHtml(vm, ctx, L) : ''}
    ${me ? `<label class="f un-lt"><span>💡 Modo aprendizaje</span><input type="checkbox" class="tg" id="unLearn" ${ctx.learn ? 'checked' : ''}></label>` : ''}
  </div>`;
}
function handHtml(vm, ctx, L) {
  const s = vm.seats[vm.yo];
  const adv = ctx.learn && LEARN.open && ctx.mine ? getAdvice(vm) : null;
  const sorted = s.mano.slice().sort((a, b) => a - b);
  const ok = new Set(L ? L.jugables : []);
  return `<div class="un-me"><div class="un-mn"><b>${esc(botName(s.nombre))}</b> · ${s.n} ${s.n === 1 ? 'carta' : 'cartas'}${vm.cfg.meta ? ' · ' + s.puntos + ' pts' : ''}</div>
    <div class="un-hand">${sorted.map(c => `<button class="hc ${ok.has(c) ? 'ok' : ctx.mine && !vm.eligeColor ? 'no' : ''} ${adv && adv.carta === c ? 'sug' : ''}" data-c="${c}">${cardHtml(c, '')}</button>`).join('')}</div></div>`;
}
function actionHtml(vm, ctx, L) {
  const yo = vm.yo, mine = !!L;
  if (mine && UNP.k === 'color') return `<div class="un-pick"><div class="mut">Elige el color en que sigue el juego:</div>${colorBtns('pc')}<button class="btn-ghost sm" id="unCancel">Cancelar</button></div>`;
  if (mine && UNP.k === 'obj') {
    const ot = []; for (let i = 0; i < vm.n; i++) if (i !== yo) ot.push(i);
    return `<div class="un-pick"><div class="mut">¿Con quién cambias tu mano?</div><div class="un-tg">${ot.map(i => `<button class="btn-ghost" data-po="${i}">${esc(nm(vm, i))}<small> · ${vm.seats[i].n} ${vm.seats[i].n === 1 ? 'carta' : 'cartas'}</small></button>`).join('')}</div><button class="btn-ghost sm" id="unCancel">Cancelar</button></div>`;
  }
  if (mine && L.color) return `<div class="un-pick"><div class="mut">La carta inicial es un comodín: elige el color.</div>${colorBtns('pcc')}</div>`;
  const adv = ctx.learn && LEARN.open && mine ? getAdvice(vm) : null;
  const sug = adv ? adv.accion.tipo : null;
  const sg = t => sug === t ? ' sug' : '';
  const expSelf = vm.expuesto && vm.expuesto.i === yo;
  const expOther = vm.expuesto && vm.expuesto.i !== yo ? vm.expuesto.i : null;
  let h = '<div class="un-act">';
  if (vm.pend) h += `<button id="aTake" class="a-take${sg('robar')}" ${mine ? '' : 'disabled'}>Robar ${vm.pend.n}</button>`;
  else h += `<button id="aTake" class="a-take${sg('robar')}" ${mine && L.robar ? '' : 'disabled'}>Robar carta</button>`;
  if (mine && L.retar) h += `<button id="aRetar" class="a-ret${sg('retar')}">Desafiar el +4</button>`;
  else if (mine && L.pasar) h += `<button id="aPass" class="a-pass${sg('pasar')}">Pasar</button>`;
  else h += `<button class="a-pass" disabled>Pasar</button>`;
  h += '</div>';
  const ex = [];
  if (expOther != null) ex.push(`<button id="aPill" class="btn-red">¡Pillar a ${esc(nm(vm, expOther))}!</button>`);
  if (expSelf) ex.push(`<button id="aUnoNow" class="a-uno on">¡UNO!</button>`);
  else if (mine && L.uno) ex.push(`<button id="aUno" class="a-uno ${UNOF.on ? 'on' : ''}">${UNOF.on ? '✓ ¡UNO! dicho' : '¡UNO!'}<small>púlsalo antes de jugar tu penúltima carta</small></button>`);
  if (ex.length) h += `<div class="un-act2">${ex.join('')}</div>`;
  return h;
}
function porque(vm, c) {
  if (vm.pend) return 'Tienes que robar ' + vm.pend.n + (vm.cfg.acum ? ' o devolver el castigo con una carta igual' : '') + '.';
  if (vm.drawn != null) return 'Solo puedes jugar la carta que has robado, o pasar.';
  if (U.esComodin(c) && U.tp(c) === U.D4) return 'El +4 solo se puede jugar si no tienes ninguna carta del color en juego (' + CN[vm.color].toLowerCase() + ').';
  return 'No coincide: tiene que ser del mismo color (' + CN[vm.color].toLowerCase() + '), número o símbolo.';
}
function bindAction(vm, ctx) {
  const yo = vm.yo; if (yo == null || yo < 0) return;
  const L = ctx.mine ? U.legal(vm, yo) : null;
  const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
  const lc = $('#unLearn'); if (lc) lc.onchange = () => { ctx.setLearn(lc.checked); LEARN.open = false; ctx.redraw(); };
  const act = a => { UNP.k = null; UNOF.on = false; ctx.act(a); };
  on('unDraw', () => act({ tipo: 'robar' }));
  on('aTake', () => act({ tipo: 'robar' }));
  on('aPass', () => act({ tipo: 'pasar' }));
  on('aRetar', () => act({ tipo: 'retar' }));
  on('aPill', () => ctx.act({ tipo: 'pillar' }));
  on('aUnoNow', () => ctx.act({ tipo: 'uno' }));
  on('aUno', () => { UNOF.on = !UNOF.on; ctx.redraw(); });
  on('unCancel', () => { UNP.k = null; ctx.redraw(); });
  document.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { const c = UNP.carta; act({ tipo: 'jugar', carta: c, color: +b.dataset.pc, uno: UNOF.on }); });
  document.querySelectorAll('[data-pcc]').forEach(b => b.onclick = () => act({ tipo: 'color', color: +b.dataset.pcc }));
  document.querySelectorAll('[data-po]').forEach(b => b.onclick = () => { const c = UNP.carta; act({ tipo: 'jugar', carta: c, objetivo: +b.dataset.po, uno: UNOF.on }); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const c = +b.dataset.c;
    if (!ctx.mine) { toast('Espera: no es tu turno'); return; }
    if (vm.eligeColor) { toast('Primero elige un color'); return; }
    if (!L.jugables.includes(c)) { toast(porque(vm, c)); return; }
    if (U.esComodin(c)) { UNP.k = 'color'; UNP.carta = c; ctx.redraw(); return; }
    if (vm.cfg.siete0 && U.tp(c) === 7 && !vm.pend) { UNP.k = 'obj'; UNP.carta = c; ctx.redraw(); return; }
    act({ tipo: 'jugar', carta: c, uno: UNOF.on });
  });
  on('unHow', openCards);
  on('unAdvice', () => { LEARN.open = true; ctx.redraw(); });
}

/* ---------- Modo aprendizaje ---------- */
function getAdvice(vm) {
  const key = stateKey(vm);
  if (LEARN.key !== key) { LEARN.key = key; LEARN.c = U.consejo(vm, vm.yo); }
  return LEARN.c;
}
function learnHtml(vm, ctx, L) {
  const s = vm.seats[vm.yo];
  const cc = [0, 0, 0, 0]; let com = 0; s.mano.forEach(c => { if (U.esComodin(c)) com++; else cc[U.col(c)]++; });
  let h = `<div class="un-learn"><b>💡 Consejos</b>
    <div class="lmano">Tu mano: ${cc.map((n, k) => `<span><i class="cdot k${k}"></i>${n}</span>`).join(' ')} <span>★ ${com}</span> · valen <b>${U.puntosMano(s.mano)}</b> puntos si otro gana la mano</div>`;
  if (ctx.mine) {
    if (LEARN.open) {
      const c = getAdvice(vm);
      if (c) h += `<div class="adv"><b>${esc(c.titulo)}</b>${c.lineas.map(l => `<div>• ${esc(l)}</div>`).join('')}</div>`;
    } else h += '<button class="btn-gold sm" id="unAdvice" style="margin-top:8px">💡 ¿Qué hago?</button>';
  } else h += '<div class="mut">Espera tu turno. Mientras, mira qué colores piden los demás: si alguien roba cuando se pide un color, seguramente no lo tiene.</div>';
  h += ' <button class="btn-ghost sm" id="unHow" style="margin-top:8px">¿Qué hace cada carta?</button></div>';
  return h;
}
function openCards() {
  const ej = [['0–9', 'Se juega sobre una carta del mismo color o del mismo número.'], ['⊘ Salta', 'El siguiente jugador pierde su turno.'], ['⇄ Cambio de sentido', 'Se invierte el orden de juego. Con dos jugadores funciona como un Salta.'], ['+2', 'El siguiente roba 2 cartas y pierde el turno (con «acumular», puede devolvértelo).'], ['★ Comodín', 'Se puede jugar siempre y eliges el color con el que sigue el juego.'], ['+4 Comodín', 'Eliges color y el siguiente roba 4 y pierde el turno. Solo puedes jugarlo si no tienes ninguna carta del color en juego; si dudan de ti, pueden desafiarte.']];
  openModal(`<h3>🃏 Qué hace cada carta</h3><div class="sub">108 cartas: 4 colores con un 0, dos de cada número del 1 al 9, y dos Salta, Cambio de sentido y +2 por color; más 4 Comodines y 4 Comodines +4.</div>
    ${ej.map(([n, d]) => `<div class="hrow"><div class="top"><div class="n">${n}<small class="wrap">${d}</small></div></div></div>`).join('')}
    <div class="hrow"><div class="top"><div class="n">Puntos<small class="wrap">Al ganar una mano sumas lo que tengan los demás en la mano: números = su valor, Salta/Cambio/+2 = 20, Comodines = 50.</small></div></div></div>
    <div class="acts"><button class="btn-gold" id="hOk">Entendido</button></div>`);
  $('#hOk').onclick = closeModal;
}
const openHands = openCards;

/* ---------- Fin de la mano / de la partida ---------- */
function manosHtml(vm) {
  const r = vm.resultado; if (!r) return '';
  return vm.seats.map((s, i) => `<div class="rl ${i === r.ganador ? 'w' : ''}"><div class="rh"><b>${i === r.ganador ? '🏆 ' : ''}${i === vm.yo ? 'Tú' : esc(botName(s.nombre))}</b>${i === r.ganador ? ' <small>se queda sin cartas</small>' : ` <small>${r.porMano[i]} pts en la mano</small>`}</div>
    ${i === r.ganador ? '' : `<div class="rcs">${r.manos[i].slice().sort((a, b) => a - b).map(c => cardHtml(c, 'xs')).join('')}</div>`}</div>`).join('');
}
function manoFinHtml(vm, ctx) {
  const r = vm.resultado, yaListo = ctx.listos && ctx.listos.includes(ctx.miId);
  const tabla = vm.cfg.meta ? `<div class="pts">${vm.seats.map((s, i) => ({ s, i })).sort((a, b) => b.s.puntos - a.s.puntos).map(({ s, i }) => `<div class="on-seat"><span class="n">${i === vm.yo ? 'Tú' : esc(botName(s.nombre))}</span><b style="color:var(--gold)">${s.puntos}</b><small class="mut"> / ${vm.cfg.meta}</small></div>`).join('')}</div>` : '';
  return `<div class="sec un-res"><h2>${r.ganador === vm.yo ? '¡Has ganado la mano!' : esc(nm(vm, r.ganador)) + ' gana la mano'} <small style="text-transform:none;color:var(--mut)">+${r.puntos} puntos</small></h2>${manosHtml(vm)}</div>
    ${tabla ? `<div class="sec"><h2>Puntos</h2>${tabla}</div>` : ''}
    <button class="btn-gold" id="unNext" style="width:100%;padding:14px" ${yaListo ? 'disabled' : ''}>${yaListo ? '⏳ Esperando a los demás…' : 'Siguiente mano ▶'}</button>`;
}
function finHtml(vm, ctx) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = vm.orden.map((i, k) => `<div class="on-seat"><span style="width:34px;text-align:center;font-size:calc(20px * var(--fs,1))">${medals[k] || (k + 1) + 'º'}</span><span class="n">${i === vm.yo ? 'Tú' : esc(botName(vm.seats[i].nombre))}</span>${vm.cfg.meta ? `<b style="color:var(--gold)">${vm.seats[i].puntos} pts</b>` : (k === 0 ? '<b style="color:var(--gold)">Gana</b>' : '')}</div>`).join('');
  const mi = vm.yo != null && vm.yo >= 0 ? vm.seats[vm.yo].place : null;
  return `<div class="sec"><h2>Clasificación final</h2>${rows}
    <div class="mut" style="margin-top:8px">${mi === 1 ? '¡Has ganado la partida! 🎉' : mi ? 'Has quedado ' + mi + 'º de ' + vm.n + '.' : ''} Guardada en tu historial.</div></div>
    <div class="sec un-res"><h2>Última mano</h2>${manosHtml(vm)}</div>
    <div class="gacts" style="display:flex;gap:8px;margin-top:8px">${ctx.finButtons}</div>`;
}

/* ================= Partida contra la máquina ================= */
function localCtx(gm) {
  const g = gm.st, vm = U.vista(g, 0);
  return { vm, ctx: { mine: g.turno === 0 && g.fase === 'jugando', learn: !!gm.learn, mode: 'ai', miId: 'yo',
    act: a => humanAct(a), redraw: () => renderGame(), setLearn: v => { gm.learn = v; save(); },
    finButtons: '<button class="btn-gold" id="unAgain" style="flex:1">🔁 Otra partida igual</button><button class="btn-ghost" id="unNew" style="flex:1">Cambiar ajustes</button>' } };
}
function humanAct(a) {
  const gm = S.game; if (!gm) return;
  const err = U.accion(gm.st, 0, a);
  if (err) { toast(err); return; }
  LEARN.open = false;
  render();
}
function botMove(gm) {
  const g = gm.st, i = g.turno; if (i == null) return;
  const a = U.elegir(g, i, gm.level);
  if (U.accion(g, i, a)) {                                         // por si acaso: robar y pasar
    if (U.accion(g, i, { tipo: 'robar' })) U.accion(g, i, { tipo: 'color', color: 0 });
    if (g.drawn != null && g.turno === i) U.accion(g, i, { tipo: 'pasar' });
  }
}
function nextHand() {
  const gm = S.game; if (!gm) return;
  U.siguienteRonda(gm.st);
  LEARN.open = false; UNP.k = null; UNOF.on = false;
  render();
}
function scheduleBots() {
  clearTimeout(AIT);
  const gm = S.game; if (!gm) return;
  const g = gm.st;
  if (g.fase !== 'jugando' || g.turno == null || !g.seats[g.turno].bot) return;
  // si el humano se ha dejado el UNO, la máquina espera un poco para que pueda decirlo
  const d = speed().bot + (g.expuesto && g.expuesto.i === 0 ? 900 : 0);
  AIT = setTimeout(() => { if (S.game !== gm) return; botMove(gm); render(); }, d);
}
function archiveLocal(gm) {
  const g = gm.st;
  if (gm.archived || S.archive.some(a => a.id === gm.id)) return;
  gm.archived = true;
  S.archive.unshift({ id: gm.id, created: gm.created, finished: Date.now(), mode: 'ai', level: gm.level, learn: !!gm.learn, n: g.n, nombres: g.seats.map(s => s.nombre), bots: g.seats.map(s => s.bot), orden: g.orden.slice(), yo: 0, place: g.seats[0].place, manos: g.ronda, meta: g.cfg.meta });
  if (S.archive.length > MAX_ARCHIVE) S.archive.length = MAX_ARCHIVE;
  Sound.play('end'); save(); autoBackup(true);
}
function sonidosMesa(vm) {
  const key = stateKey(vm);
  if (LAST.key === key) return;
  const prev = LAST.key; LAST.key = key;
  if (prev === null) return;
  const pm = prev.split('|');
  if (vm.fase === 'fin') return;
  if (vm.fase === 'ronda_fin') { const gano = vm.resultado && vm.resultado.ganador === vm.yo; setTimeout(() => Sound.play(gano ? 'win' : 'lose'), 200); return; }
  if (+pm[0] !== vm.ronda) { Sound.play('deal'); return; }
  const u = vm.ultimo; if (!u) return;
  const k = ({ jugar: 'card', robar: 'draw', pasar: 'draw', uno: 'uno', pillar: 'pillar', retar: 'pillar', color: 'card' })[u.tipo];
  if (k) Sound.play(k);
}
function bindTable(vm, ctx) {
  bindAction(vm, ctx);
  const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
  on('unNext', ctx.next || nextHand);
  on('unAgain', () => { const gm = S.game; S.game = null; syncSame(gm); });
  on('unNew', () => { S.game = null; render(); });
  on('onRe', () => onEnviar({ t: 'jugada', a: { tipo: 'revancha' } }));
  on('onLeave2', () => { onEnviar({ t: 'salir' }); S.draft.mode = 'online'; save(); });
}
function syncSame(gm) {
  if (gm) { const d = S.draft.ai; d.level = gm.level; d.learn = !!gm.learn; }
  startAi();
}
function renderGame() {
  const gm = S.game, g = gm.st;
  if (g.fase === 'fin') archiveLocal(gm);
  const { vm, ctx } = localCtx(gm);
  $('#subtitle').textContent = g.fase === 'fin' ? 'Partida terminada' : 'Contra la máquina · ' + LEVELS[gm.level].name;
  sonidosMesa(vm);
  if (!ctx.mine) UNP.k = null;
  $('#app').innerHTML = tableHtml(vm, ctx);
  bindTable(vm, ctx);
  scheduleBots();
}


/* ================= Juego en línea (servidor común de IT Canarias) ================= */

const ON = { recibido: 0, ws: null, estado: 'desconectado', sala: null, quiere: false, intentos: 0, timer: null, ping: null, listo: null, rolling: false, ultimoTurno: null };
function onToken() {
  S.online = S.online || {};
  if (!S.online.token) { const a = new Uint8Array(18); crypto.getRandomValues(a); S.online.token = Array.from(a, b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join(''); save(); }
  return S.online.token;
}
const onNombre = () => (S.online && S.online.nombre) || '';
function onConectar() {
  if (!ONLINE_URL) return;
  ON.quiere = true;
  if (ON.ws && (ON.ws.readyState === 0 || ON.ws.readyState === 1)) return;
  clearTimeout(ON.timer);
  onSetEstado('conectando');
  let ws;
  try { ws = new WebSocket(ONLINE_URL); } catch (e) { onReintentar(); return; }
  ON.ws = ws;
  ws.onopen = () => {
    ON.intentos = 0; onSetEstado('conectado');
    ws.send(JSON.stringify({ t: 'hola', token: onToken(), nombre: onNombre() }));
    clearInterval(ON.ping); ON.ping = setInterval(() => onEnviar({ t: 'ping' }), 25000);
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'hola') {
      if (!Array.isArray(m.juegos) || !m.juegos.includes('uno')) { ON.listo = false; onSetEstado('preparando'); ON.ws = null; ws.close(); clearTimeout(ON.timer); if (ON.quiere) ON.timer = setTimeout(onConectar, 60000); return; }
      ON.listo = true; onSetEstado('conectado');
      return;
    }
    if (m.t === 'sala') { ON.listo = true; ON.recibido = Date.now(); onRecibirSala(m.sala); }
    else if (m.t === 'lista') Publicas.recibir(m);
    else if (m.t === 'error') { ON.rolling = false; if (!Publicas.error(m)) toast(m.msg); }
    else if (m.t === 'fuera') { toast(m.motivo || 'Has salido de la partida'); onRecibirSala(null); }
  };
  ws.onclose = () => { if (ON.ws !== ws) return; clearInterval(ON.ping); ON.ws = null; onSetEstado('desconectado'); if (ON.quiere) onReintentar(); };
  ws.onerror = () => {};
}
function onReintentar() { clearTimeout(ON.timer); const ms = Math.min(15000, 1000 * 2 ** ON.intentos++); ON.timer = setTimeout(onConectar, ms); }
function onEnviar(m) {
  if (!ON.ws || ON.ws.readyState !== 1) { if (m.t !== 'ping') toast('Sin conexión con el servidor. Reintentando…'); onConectar(); return false; }
  ON.ws.send(JSON.stringify(m)); return true;
}
function onSetEstado(e) {
  if (e === 'desconectado' && ON.listo === false) e = 'preparando';
  ON.estado = e;
  document.querySelectorAll('#onJoin, #onCreate').forEach(b => { b.disabled = e === 'preparando'; });
  const el = $('#onStatus'); if (el) el.innerHTML = onEstadoHtml();
}
const onEstadoHtml = () => ({ conectado: '🟢 Conectado', conectando: '🟡 Conectando…', desconectado: '🔴 Sin conexión · reintentando', preparando: '🛠 El UNO en línea estará disponible muy pronto' })[ON.estado];
document.addEventListener('visibilitychange', () => { if (!document.hidden && ON.quiere && ON.estado !== 'conectado') { ON.intentos = 0; onConectar(); } });

function onRecibirSala(sala) {
  const antes = ON.sala;
  ON.sala = sala;
  S.online = S.online || {}; S.online.enSala = !!sala; save();
  if (sala && sala.partida) {
    const p = sala.partida;
    const miTurno = sala.estado === 'jugando' && p.turnoSilla === sala.yo;
    if (miTurno && ON.ultimoTurno !== sala.yo) AvisoTurno.sonar();          // sonido y vibración (se quita en ajustes)
    ON.ultimoTurno = sala.estado === 'jugando' ? p.turnoSilla : null;
    if (sala.estado === 'fin') onArchivar(sala);
  }
  if (!sala && !antes) return;
  if (!S.game) render();
}
// Al terminar: la partida pasa al historial
function onArchivar(sala) {
  const p = sala.partida; if (!p || !p.partida) return;
  const pa = p.partida, id = 'on-' + pa.id;
  if (S.archive.some(a => a.id === id)) return;
  S.archive.unshift({ id, created: pa.created, finished: Date.now(), mode: 'online', level: 0, learn: !!(S.online && S.online.learn), n: pa.nombres.length, nombres: pa.nombres.map(botName), bots: pa.bots, orden: pa.orden.slice(), yo: p.yo == null ? 0 : p.yo, place: p.yo == null ? 0 : p.seats[p.yo].place, manos: pa.manos, meta: pa.meta });
  if (S.archive.length > MAX_ARCHIVE) S.archive.length = MAX_ARCHIVE;
  Sound.play('end'); save(); autoBackup(true);
}
function renderOnline() {
  S.online = S.online || {};
  if (!ON.quiere) onConectar();
  const s = ON.sala;
  if (!s) return onRenderInicio();
  if (s.estado === 'espera') return onRenderEspera(s);
  return onRenderMesa(s);
}
const RITMO_S = { relajado: 60, normal: 40, rapido: 20 };
function onRenderInicio() {
  $('#subtitle').textContent = 'Jugar en línea';
  const o = Object.assign({ nivel: 'normal', meta: 500, acum: false, siete0: false, penal: 4, ritmo: 'normal' }, (S.online && S.online.opciones) || {});
  $('#app').innerHTML = `${modeTabs()}
    <div class="sec"><h2>Tu nombre</h2>
      <input id="onName" maxlength="18" placeholder="Cómo te verán los demás" value="${esc(onNombre())}" autocomplete="off" style="width:100%"></div>
    ${Publicas.html()}
    <div class="sec"><h2>Unirse a una partida</h2>
      <div class="mut" style="margin-bottom:8px">Pide el código a quien la ha creado.</div>
      <div class="row" style="gap:8px"><input id="onCode" maxlength="4" placeholder="Código" value="${esc((S.online && S.online.codigo) || '')}" autocomplete="off" autocapitalize="characters" style="flex:1;min-width:0;width:auto;text-transform:uppercase;letter-spacing:4px;text-align:center">
      <button class="btn-gold" id="onJoin" style="flex:1;min-width:0" ${ON.estado === 'preparando' ? 'disabled' : ''}>Unirse</button></div></div>
    <div class="sec"><h2>Crear una partida</h2>
      <label class="f"><span>Nivel de la máquina<em>Si rellenas sillas con la máquina</em></span>${optBtns(['facil', 'normal', 'dificil'], o.nivel, 'nivel', v => ({ facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' })[v])}</label>
      <label class="f"><span>Se juega a</span>${optBtns(METAS, o.meta, 'meta', metaTxt)}</label>
      ${rulesOpts(o, 'on')}
      <label class="f"><span>Tiempo por jugada<em>Si te pasas, robas y pasas solo</em></span>${optBtns(['relajado', 'normal', 'rapido'], o.ritmo, 'ritmo', v => RITMO_S[v] + ' s')}</label>
      ${Publicas.casilla()}
      <button class="btn-gold" id="onCreate" style="width:100%;margin-top:8px" ${ON.estado === 'preparando' ? 'disabled' : ''}>Crear partida</button></div>
    <div class="mut" style="text-align:center;margin:0 0 4px">De 2 a 10 jugadores; las sillas libres las puede ocupar la máquina. El mazo lo baraja el servidor y nadie ve tus cartas.</div>
    <div class="mut" id="onStatus" style="text-align:center;margin:6px 0 20px">${onEstadoHtml()}</div>`;
  bindModeTabs();
  const nameOk = () => { const n = cleanName($('#onName').value).slice(0, 18); if (!n) { toast('Escribe tu nombre'); $('#onName').focus(); return null; } S.online.nombre = n; save(); return n; };
  $('#onName').onchange = () => { S.online.nombre = cleanName($('#onName').value).slice(0, 18); save(); };
  document.querySelectorAll('[data-opt] button').forEach(b => b.onclick = () => b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)));
  $('#onCode').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  $('#onJoin').onclick = () => {
    const n = nameOk(); if (!n) return;
    const c = $('#onCode').value.trim().toUpperCase(); if (c.length !== 4) { toast('El código tiene 4 letras o números'); return; }
    onEnviar({ t: 'unirse', codigo: c, nombre: n });
  };
  const leerOpciones = () => {
    const v = k => { const b = document.querySelector(`[data-opt="${k}"] .on`); return b ? b.dataset.v : undefined; };
    const opciones = { nivel: v('nivel'), meta: +v('meta'), acum: $('#onAcum').checked, siete0: $('#onSiete').checked, penal: +v('onpenal'), ritmo: v('ritmo') };
    S.online.opciones = opciones; save(); return opciones;
  };
  $('#onCreate').onclick = () => {
    const n = nameOk(); if (!n) return;
    const opciones = leerOpciones();
    onEnviar({ t: 'crear', juego: 'uno', opciones, publica: Publicas.marcada(), nombre: n });
  };
  Publicas.montar({ juego: 'uno', enviar: onEnviar, nombre: nameOk, opciones: leerOpciones, conectado: () => ON.estado === 'conectado' });
}
function onRenderEspera(s) {
  $('#subtitle').textContent = 'Partida en línea · esperando';
  const host = s.asientos.find(a => a.anfitrion);
  const op = s.opciones || {};
  $('#app').innerHTML = `
    <div class="sec" style="text-align:center"><div class="mut">Código de la partida</div>
      <div class="on-code">${esc(s.codigo)}</div>
      <button class="btn-gold" id="onInvite" style="width:100%">📲 Enviar el código (WhatsApp…)</button>
      <div class="mut" style="margin-top:8px">Los demás abren UNO → <b>En línea</b> → <b>Unirse</b> y ponen el código.</div>
      <div class="mut" style="margin-top:6px">${esc(metaTxt(op.meta == null ? 500 : op.meta))}${op.acum ? ' · acumula +2/+4' : ''}${op.siete0 ? ' · 7-0' : ''} · castigo ${op.penal || 4} · ${RITMO_S[op.ritmo] || 40} s por jugada</div></div>
    ${Publicas.aviso(s)}
    <div class="sec"><h2>Jugadores (${s.asientos.length}/${s.max})</h2>
      ${s.asientos.map(a => `<div class="on-seat"><span class="on-dot ${a.conectado ? 'ok' : ''}"></span><span class="n">${esc(a.nombre)}${a.id === s.yo ? ' <small>(tú)</small>' : ''}${a.anfitrion ? ' 👑' : ''}</span>
        ${s.anfitrion && a.id !== s.yo ? `<button class="btn-ghost sm" data-quitar="${a.id}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}
      ${s.anfitrion && s.asientos.length < s.max ? '<button class="btn-ghost" id="onBot" style="width:100%;margin-top:8px">🤖 Añadir a la máquina</button>' : ''}</div>
    ${s.anfitrion
      ? `<button class="btn-gold" id="onStart" style="width:100%" ${s.asientos.length >= s.min ? '' : 'disabled'}>Repartir 🃏</button>
         <div class="mut" style="text-align:center;margin-top:6px">${s.asientos.length < s.min ? 'Espera a que entre alguien o añade a la máquina.' : 'Cuando estéis todos, reparte.'}</div>`
      : `<div class="sec" style="text-align:center">⏳ Esperando a que ${esc(host ? host.nombre : 'el anfitrión')} reparta…</div>`}
    <button class="btn-ghost" id="onLeave" style="width:100%;margin-top:12px">Salir</button>
    <div class="mut" id="onStatus" style="text-align:center;margin:10px 0 20px">${onEstadoHtml()}</div>`;
  $('#onInvite').onclick = () => onInvitar(s.codigo);
  const b = $('#onBot'); if (b) b.onclick = () => onEnviar({ t: 'bot' });
  const st = $('#onStart'); if (st) st.onclick = () => onEnviar({ t: 'empezar' });
  document.querySelectorAll('[data-quitar]').forEach(x => x.onclick = () => onEnviar({ t: 'quitar', asiento: x.dataset.quitar }));
  $('#onLeave').onclick = () => confirmBox('Salir', 'Saldrás de esta partida.', 'Salir', () => onEnviar({ t: 'salir' }));
}

async function onInvitar(codigo) {
  const text = Invitacion.texto('🃏', 'UNO', codigo);
  try {
    if (isNative()) { await window.Capacitor.Plugins.Share.share({ title: 'Partida de UNO', text, dialogTitle: 'Invitar' }); return; }
    if (navigator.share) { await navigator.share({ title: 'Partida de UNO', text }); return; }
    await navigator.clipboard.writeText(text); toast('Invitación copiada');
  } catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e.name)))) toast('No se pudo compartir'); }
}

let TIMERI = null;
function onRenderMesa(s) {
  const p = s.partida, ended = s.estado === 'fin';
  $('#subtitle').textContent = ended ? 'En línea · terminada' : 'En línea · ' + s.codigo;
  const yaRev = (s.revancha || []).includes(s.yo);
  const mine = !ended && p.yo != null && p.turnoSilla === s.yo && p.fase === 'jugando';
  const hasta = p.resta != null ? ON.recibido + p.resta : null;
  const seg = () => Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  const ctx = { mine, learn: !!(S.online && S.online.learn), mode: 'online', miId: s.yo, listos: p.listos || [],
    timer: hasta != null ? seg() + ' s' : '',
    act: a => { LEARN.open = false; onEnviar({ t: 'jugada', a }); },
    redraw: () => { if (ON.sala && ON.sala.partida) onRenderMesa(ON.sala); },
    setLearn: v => { S.online = S.online || {}; S.online.learn = v; save(); },
    next: () => onEnviar({ t: 'jugada', a: { tipo: 'seguir' } }),
    finButtons: `<button class="btn-gold" id="onRe" style="flex:1" ${yaRev ? 'disabled' : ''}>${yaRev ? '⏳ Esperando a los demás' : '🔁 Revancha'}</button><button class="btn-ghost" id="onLeave2" style="flex:1">Salir</button>` };
  sonidosMesa(p);
  if (!mine) UNP.k = null;
  $('#app').innerHTML = tableHtml(p, ctx) + (ended ? '' : `<div class="mut" id="onStatus" style="text-align:center;margin:6px 0 20px">${onEstadoHtml()} · ${esc(s.codigo)}</div>`);
  bindTable(p, ctx);
  clearInterval(TIMERI);
  if (hasta != null) TIMERI = setInterval(() => { const el = $('#unTimer'); if (!el) { clearInterval(TIMERI); return; } el.textContent = seg() + ' s'; }, 500);
}

function leaveOnline() {
  const s = ON.sala;
  if (!s) return;
  if (s.estado === 'jugando') confirmBox('Abandonar la partida', 'Tu silla la ocupará la máquina hasta el final.', 'Abandonar', () => onEnviar({ t: 'salir' }));
  else onEnviar({ t: 'salir' });
}
/* ---------- Invitación con enlace: entrar directamente en la sala ---------- */
function onUnirsePendiente(t0) {
  if (!ON.unirse) return;
  if (ON.estado === 'conectado' && ON.listo) { const c = ON.unirse; ON.unirse = null; onEnviar({ t: 'unirse', codigo: c, nombre: onNombre() }); return; }
  if (Date.now() - t0 > 20000) { ON.unirse = null; toast('Sin conexión con el servidor. Prueba otra vez en un momento.'); return; }
  setTimeout(() => onUnirsePendiente(t0), 300);
}
window.unirseDesdeEnlace = function (codigo) {
  const go = () => {
    S.draft.mode = 'online'; save();
    if (ON.sala && ON.sala.codigo === codigo) { render(); return; }
    S.online = S.online || {}; S.online.codigo = codigo; save();
    if (!onNombre()) {
      render();
      // sin nombre todavía: se pide en una ventana y se entra directamente
      openModal(`<h3>🎟 Partida ${esc(codigo)}</h3><div class="sub">Te han invitado. Escribe tu nombre para entrar.</div>
        <input id="invName" maxlength="18" placeholder="Tu nombre" autocomplete="off" style="width:100%">
        <div class="acts"><button class="btn-ghost" id="invNo">Cancelar</button><button class="btn-gold" id="invOk">Entrar</button></div>`);
      const n = $('#invName'); setTimeout(() => n && n.focus(), 50);
      const ok = () => { const v = cleanName(n.value).slice(0, 18); if (!v) { toast('Escribe tu nombre'); n.focus(); return; } S.online.nombre = v; save(); closeModal(); go(); };
      $('#invOk').onclick = ok; n.onkeydown = e => { if (e.key === 'Enter') ok(); };
      $('#invNo').onclick = closeModal;
      return;
    }
    ON.unirse = codigo; onConectar(); render(); toast('Entrando en la partida ' + codigo + '…');
    onUnirsePendiente(Date.now());
  };
  if (ON.sala && ON.sala.codigo !== codigo && ON.sala.estado === 'jugando') { toast('Antes sal de la partida en línea en la que estás'); return; }
  if (S.game && S.game.st.fase === 'fin') S.game = null;
  if (S.game) confirmBox('Partida en línea', 'Tienes una partida empezada en este móvil. Se abandonará y entrarás en la partida a la que te invitan.', 'Entrar', () => { clearTimeout(AIT); S.game = null; go(); });
  else go();
};
setTimeout(() => { try { Invitacion.listo(); } catch (e) {} }, 0);

// Al abrir la app: si estabas en una partida en línea, vuelve a ella
document.addEventListener('DOMContentLoaded', () => { try { if (S.online && S.online.enSala) onConectar(); } catch (e) {} });
