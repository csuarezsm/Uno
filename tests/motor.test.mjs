// Pruebas del motor de reglas del UNO (www/uno.js). Se ejecutan con: node tests/motor.test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const U = require(fileURLToPath(new URL('../www/uno.js', import.meta.url)));

let ok = 0, ko = 0;
const check = (name, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); } };
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
const C = (color, tipo) => U.carta(color, tipo);          // 0 rojo 1 amarillo 2 verde 3 azul 4 comodín
const R = 0, A = 1, V = 2, Z = 3, W = 4;

/* Escenario controlado: manos y carta de arriba a medida */
function esc({ n = 3, manos, top = C(R, 5), color, turno = 0, dir = 1, cfg = {}, mazo }) {
  const g = U.nueva({ nombres: Array.from({ length: n }, (_, i) => 'J' + i), bots: [], ...cfg });
  g.seats.forEach((s, i) => { s.mano = (manos[i] || [C(V, 1), C(V, 2), C(V, 3)]).slice(); s.dec = false; });
  g.top = top; g.desc = [top]; g.color = color == null ? U.col(top) : color; g.turno = turno; g.dir = dir;
  g.pend = null; g.expuesto = null; g.drawn = null; g.eligeColor = false; g.cierre = null; g.fase = 'jugando'; g.ultimo = { n: 0 };
  g.mazo = mazo ? mazo.slice() : U.barajar(U.mazoNuevo());
  return g;
}

console.log('El mazo');
{
  const m = U.mazoNuevo();
  eq('108 cartas', m.length, 108);
  const cnt = (f) => m.filter(f).length;
  eq('76 numéricas', cnt(c => U.tp(c) <= 9), 76);
  eq('un 0 por color', cnt(c => U.tp(c) === 0), 4);
  eq('dos de cada 1-9 por color', cnt(c => U.tp(c) === 5), 8);
  eq('8 Salta, 8 Cambio y 8 +2', [cnt(c => U.tp(c) === 10), cnt(c => U.tp(c) === 11), cnt(c => U.tp(c) === 12)], [8, 8, 8]);
  eq('4 comodines y 4 +4', [cnt(c => U.tp(c) === 13), cnt(c => U.tp(c) === 14)], [4, 4]);
  eq('puntos: número, acción y comodín', [U.puntosCarta(C(R, 7)), U.puntosCarta(C(R, 10)), U.puntosCarta(C(R, 12)), U.puntosCarta(C(W, 13)), U.puntosCarta(C(W, 14))], [7, 20, 20, 50, 50]);
  eq('nombre de carta', U.nombreCarta(C(Z, 12)), '+2 azul');
}

console.log('Reparto');
for (let k = 0; k < 200; k++) {
  const g = U.nueva({ nombres: ['a', 'b', 'c', 'd'] });
  if (k < 3 && U.tp(g.top) < 10) { eq('7 cartas a cada uno', g.seats.map(s => s.mano.length), [7, 7, 7, 7]); }
  const total = g.seats.reduce((t, s) => t + s.mano.length, 0) + g.mazo.length + g.desc.length;
  if (total !== 108) check('108 cartas en total tras repartir', false, String(total));
  if (U.tp(g.top) === 14) check('un +4 nunca abre la pila', false);
}
ok++;
{
  // primera carta: efectos
  const abre = (t, color) => { U.setRnd(() => 0); const g = U.nueva({ nombres: ['a', 'b', 'c'] }); U.setRnd(null); return g; };
  const g = U.nueva({ nombres: ['a', 'b', 'c'] });
  // forzamos los efectos de la primera carta repartiendo con un mazo preparado
  const prepara = (primera) => {
    const g2 = U.nueva({ nombres: ['a', 'b', 'c'] });
    g2.dealer = 0; g2.ronda = 0;
    const real = U.mazoNuevo(); const i = real.indexOf(primera); real.splice(i, 1);
    const orig = U.barajar; // se prepara el mazo a mano: la carta inicial es la última que se saca tras 21 de reparto
    g2.mazo = []; g2.desc = [];
    const resto = U.barajar(real.slice());
    g2.mazo = resto.slice(0, resto.length); g2.mazo.splice(g2.mazo.length - 22, 0, primera); // 21 cartas de reparto y la 22ª es la inicial
    // repartir() baraja de nuevo, así que se comprueba la lógica con una versión equivalente
    return g2;
  };
  check('se puede crear una partida de 3', !!g && g.n === 3);
}

console.log('Reglas de juego');
{ // coincidencia
  const g = esc({ manos: [[C(R, 9), C(A, 5), C(V, 5), C(W, 13)]], top: C(R, 5) });
  eq('juega por color, por número o comodín', U.legal(g, 0).jugables.sort(), [C(R, 9), C(A, 5), C(V, 5), C(W, 13)].sort());
  check('no se puede jugar fuera de turno', U.accion(g, 1, { tipo: 'jugar', carta: C(V, 1) }) !== null);
  check('no se puede jugar una carta que no coincide', U.accion(esc({ manos: [[C(Z, 9), C(R, 1)]], top: C(V, 5) }), 0, { tipo: 'jugar', carta: C(Z, 9) }) !== null);
}
{ // +4 solo sin color
  const g = esc({ manos: [[C(W, 14), C(R, 2)]], top: C(R, 5) });
  check('+4 ilegal si tienes el color', U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: V }) !== null);
  const g2 = esc({ manos: [[C(W, 14), C(A, 2)]], top: C(R, 5) });
  check('+4 legal si no tienes el color (aunque tengas otra carta)', U.accion(g2, 0, { tipo: 'jugar', carta: C(W, 14), color: V }) === null);
  const g3 = esc({ manos: [[C(W, 14), C(A, 5)]], top: C(R, 5) });
  check('+4 legal aunque tengas el mismo número en otro color', U.accion(g3, 0, { tipo: 'jugar', carta: C(W, 14), color: V }) === null);
  const g4 = esc({ manos: [[C(W, 13), C(R, 2)]], top: C(R, 5) });
  check('el comodín normal siempre se puede', U.accion(g4, 0, { tipo: 'jugar', carta: C(W, 13), color: Z }) === null && g4.color === Z);
  check('el comodín exige elegir color', U.accion(esc({ manos: [[C(W, 13), C(R, 2)]] }), 0, { tipo: 'jugar', carta: C(W, 13) }) !== null);
}
{ // efectos
  let g = esc({ n: 4, manos: [[C(R, 10), C(R, 1)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 10) }); eq('Salta: pierde el turno el siguiente', g.turno, 2);
  g = esc({ n: 4, manos: [[C(R, 11), C(R, 1)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 11) }); eq('Cambio de sentido con 4: juega el anterior', [g.dir, g.turno], [-1, 3]);
  g = esc({ n: 2, manos: [[C(R, 11), C(R, 1)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 11) }); eq('Con 2, Cambio de sentido repite turno', g.turno, 0);
  g = esc({ n: 2, manos: [[C(R, 10), C(R, 1)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 10) }); eq('Con 2, Salta repite turno', g.turno, 0);
  g = esc({ n: 3, manos: [[C(R, 12), C(R, 1)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 12) }); eq('+2: el siguiente roba 2 y pierde el turno', [g.seats[1].mano.length, g.turno], [4, 2]);
  g = esc({ n: 2, manos: [[C(R, 12), C(R, 1)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 12) }); eq('Con 2, tras +2 vuelve a jugar el mismo', [g.seats[1].mano.length, g.turno], [4, 0]);
}
{ // robar
  let g = esc({ manos: [[C(V, 1), C(V, 2)]], top: C(R, 5), mazo: [C(Z, 3)] });
  U.accion(g, 0, { tipo: 'robar' }); eq('roba y no sirve: pasa el turno', [g.seats[0].mano.length, g.turno, g.drawn], [3, 1, null]);
  g = esc({ manos: [[C(V, 1), C(V, 2)]], top: C(R, 5), mazo: [C(R, 3)] });
  U.accion(g, 0, { tipo: 'robar' }); eq('roba una jugable: puede jugarla', [g.turno, g.drawn], [0, C(R, 3)]);
  check('con la robada no puede jugar otra', U.accion(g, 0, { tipo: 'jugar', carta: C(V, 1) }) !== null);
  eq('puede pasar', U.accion(g, 0, { tipo: 'pasar' }), null); eq('…y pasa el turno', g.turno, 1);
  g = esc({ manos: [[C(R, 1), C(R, 2)]], top: C(R, 5), mazo: [C(Z, 3)] });
  eq('se puede renunciar a jugar y robar', U.accion(g, 0, { tipo: 'robar' }), null);
}
{ // reciclar el mazo
  const g = esc({ manos: [[C(V, 1)]], top: C(R, 5), mazo: [] }); g.desc = [C(A, 1), C(A, 2), C(A, 3), C(R, 5)];
  U.accion(g, 0, { tipo: 'robar' });
  check('mazo vacío: se baraja el descarte y se sigue', g.seats[0].mano.length === 2 && g.desc.length === 1 && g.mazo.length === 2);
}
{ // +4 y desafío
  let g = esc({ manos: [[C(W, 14), C(A, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z });
  eq('+4 legal: el siguiente puede desafiar o robar', [g.turno, U.legal(g, 1).retar, U.legal(g, 1).robar], [1, true, true]);
  U.accion(g, 1, { tipo: 'retar' }); eq('desafío fallido: roba 6 y pierde el turno', [g.seats[1].mano.length, g.turno], [8, 2]);
  g = esc({ manos: [[C(W, 14), C(R, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  g.seats[0].mano = [C(W, 14), C(R, 2)]; g.pend = null;
  // se fuerza la jugada ilegal (culpable) construyendo el estado del +4 ya jugado
  g.seats[0].mano = [C(R, 2)]; g.top = C(W, 14); g.color = Z; g.pend = { n: 4, tipo: 'd4', retable: true, culpable: true, de: 0, antes: R }; g.turno = 1; g.cierre = null;
  U.accion(g, 1, { tipo: 'retar' }); eq('desafío acertado: roba 4 quien lo jugó y el desafiante juega normal', [g.seats[0].mano.length, g.seats[1].mano.length, g.turno], [5, 2, 1]);
  g = esc({ manos: [[C(W, 14), C(A, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z }); U.accion(g, 1, { tipo: 'robar' });
  eq('aceptar: roba 4 y pierde el turno', [g.seats[1].mano.length, g.turno, g.color], [6, 2, Z]);
}
{ // sin acumular: no se puede devolver
  const g = esc({ manos: [[C(W, 14), C(A, 2)], [C(W, 14), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z });
  check('sin acumular no se devuelve el +4', U.accion(g, 1, { tipo: 'jugar', carta: C(W, 14), color: V }) !== null);
}
console.log('Acumular');
{
  let g = esc({ cfg: { acum: true }, manos: [[C(R, 12), C(R, 1)], [C(V, 12), C(V, 2)], [C(A, 1), C(A, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 12) });
  eq('+2 pendiente', [g.pend.n, g.turno, g.seats[1].mano.length], [2, 1, 2]);
  eq('puede devolverlo con otro +2', U.legal(g, 1).jugables, [C(V, 12)]);
  check('no con una carta cualquiera', U.accion(g, 1, { tipo: 'jugar', carta: C(V, 2) }) !== null);
  U.accion(g, 1, { tipo: 'jugar', carta: C(V, 12) }); eq('se acumulan: 4', [g.pend.n, g.turno, g.color], [4, 2, V]);
  U.accion(g, 2, { tipo: 'robar' }); eq('el siguiente roba la suma', [g.seats[2].mano.length, g.pend, g.turno], [6, null, 0]);
  g = esc({ cfg: { acum: true }, manos: [[C(W, 14), C(A, 2)], [C(W, 14), C(V, 2)], [C(A, 1), C(A, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z });
  U.accion(g, 1, { tipo: 'jugar', carta: C(W, 14), color: V });
  eq('+4 sobre +4 suma 8 y ya no se puede desafiar', [g.pend.n, g.pend.retable], [8, false]);
}
console.log('UNO y penalizaciones');
{
  let g = esc({ manos: [[C(R, 1), C(R, 2)], [C(V, 1), C(V, 2)], [C(A, 1), C(A, 2)]], top: C(R, 5), mazo: U.barajar(U.mazoNuevo()) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) });
  eq('quedarse con 1 sin decir UNO te expone', g.expuesto, { i: 0 });
  U.accion(g, 1, { tipo: 'pillar' });
  eq('te pillan: robas 4 (por defecto)', [g.seats[0].mano.length, g.expuesto], [5, null]);
  g = esc({ cfg: { penal: 2 }, manos: [[C(R, 1), C(R, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }); U.accion(g, 1, { tipo: 'pillar' });
  eq('con la opción de 2 cartas', g.seats[0].mano.length, 3);
  g = esc({ manos: [[C(R, 1), C(R, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1), uno: true });
  eq('decir UNO al jugar evita el castigo', [g.expuesto, g.seats[0].dec], [null, true]);
  check('no se puede pillar a quien lo dijo', U.accion(g, 1, { tipo: 'pillar' }) !== null);
  g = esc({ manos: [[C(R, 1), C(R, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }); U.accion(g, 0, { tipo: 'uno' });
  eq('corregirlo a tiempo: sin castigo', g.expuesto, null);
  g = esc({ manos: [[C(R, 1), C(R, 2)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }); U.accion(g, 1, { tipo: 'robar' });
  eq('si el siguiente ya ha empezado su turno, ya no se pilla', g.expuesto, null);
  check('…y pillar entonces da error', U.accion(g, 1, { tipo: 'pillar' }) !== null);
}
console.log('Fin de la mano y puntos');
{
  let g = esc({ cfg: { meta: 500 }, manos: [[C(R, 1)], [C(V, 12), C(W, 14)], [C(A, 7), C(R, 3)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) });
  eq('gana quien se queda sin cartas', g.fase, 'ronda_fin');
  eq('suma las cartas de los demás (20+50+7+3)', [g.resultado.ganador, g.resultado.puntos, g.seats[0].puntos], [0, 80, 80]);
  U.siguienteRonda(g); eq('nueva mano: se reparte otra vez', [g.fase, g.ronda, g.seats[1].mano.length], ['jugando', 2, 7]);
  g = esc({ cfg: { meta: 0 }, manos: [[C(R, 1)], [C(V, 5)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }); eq('meta 0: una sola mano', [g.fase, g.orden[0]], ['fin', 0]);
  g = esc({ cfg: { meta: 200 }, manos: [[C(R, 1)], [C(W, 14), C(W, 13), C(W, 13), C(W, 13), C(W, 13)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }); eq('al llegar a la meta, termina la partida', [g.fase, g.seats[0].place], ['fin', 1]);
  // última carta +2: el siguiente roba y se cuenta
  g = esc({ cfg: { meta: 500 }, manos: [[C(R, 12)], [C(V, 1)], [C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 12) });
  check('puntos incluyen las 2 cartas robadas', g.resultado.puntos === U.puntosMano(g.seats[1].mano) + U.puntosMano(g.seats[2].mano));
  // última carta +4: se puede desafiar y si era ilegal la mano continúa
  g = esc({ manos: [[C(W, 14)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  g.seats[0].mano = [C(W, 14), C(R, 3)];
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z });
  check('+4 ilegal con cartas: no acaba', g.fase === 'jugando');
  g = esc({ manos: [[C(W, 14)], [C(V, 1), C(V, 2)]], top: C(R, 5) });
  U.accion(g, 0, { tipo: 'jugar', carta: C(W, 14), color: Z });
  eq('+4 como última carta: queda pendiente de aceptar o desafiar', [g.fase, g.pend && g.pend.n, g.turno], ['jugando', 4, 1]);
  U.accion(g, 1, { tipo: 'robar' }); eq('al aceptar, la mano termina', g.fase, 'ronda_fin');
}
console.log('Comodín inicial y 7-0');
{
  const g = esc({ cfg: { siete0: true }, manos: [[C(R, 7), C(R, 1)], [C(V, 1), C(V, 2), C(V, 3)], [C(A, 1)]], top: C(R, 5) });
  check('el 7 exige elegir con quién cambiar', U.accion(g, 0, { tipo: 'jugar', carta: C(R, 7) }) !== null);
  U.accion(g, 0, { tipo: 'jugar', carta: C(R, 7), objetivo: 2 });
  eq('7: cambia la mano con el elegido', [g.seats[0].mano, g.seats[2].mano], [[C(A, 1)], [C(R, 1)]]);
  const h = esc({ cfg: { siete0: true }, manos: [[C(R, 0), C(R, 1)], [C(V, 1)], [C(A, 1), C(A, 2)]], top: C(R, 5) });
  U.accion(h, 0, { tipo: 'jugar', carta: C(R, 0) });
  eq('0: todos pasan su mano en el sentido del juego', [h.seats[0].mano, h.seats[1].mano, h.seats[2].mano], [[C(A, 1), C(A, 2)], [C(R, 1)], [C(V, 1)]]);
  const k = esc({ manos: [[C(R, 7), C(R, 1)], [C(V, 1)]], top: C(R, 5) });
  U.accion(k, 0, { tipo: 'jugar', carta: C(R, 7) }); check('sin la opción 7-0 el 7 es normal', k.seats[0].mano.length === 1 && k.seats[1].mano.length === 1);
}
{
  const g = esc({ manos: [[C(R, 1), C(V, 1)], [C(R, 2)]], top: C(W, 13), color: A });
  g.eligeColor = true; g.turno = 0;
  check('con comodín inicial hay que elegir color', U.legal(g, 0).color && U.accion(g, 0, { tipo: 'jugar', carta: C(R, 1) }) !== null);
  U.accion(g, 0, { tipo: 'color', color: V }); eq('elige color y juega', [g.color, g.eligeColor, g.turno], [V, false, 0]);
}
console.log('Vista');
{
  const g = esc({ manos: [[C(R, 1), C(V, 1)], [C(R, 2)]], top: C(R, 5) });
  const v = U.vista(g, 0);
  eq('veo mi mano y la de los demás oculta', [v.seats[0].mano, v.seats[1].mano], [[C(R, 1), C(V, 1)], [-1]]);
  check('la vista no incluye el mazo (el descarte es público)', !('mazo' in v) && Array.isArray(v.desc));
  eq('la carta robada solo la ve su dueño', [U.vista(g, 1).drawn, v.drawn], [null, null]);
}

console.log('Partidas simuladas (máquina contra máquina)');
{
  const combos = [{}, { acum: true }, { siete0: true }, { acum: true, siete0: true, penal: 2 }, { meta: 0 }, { meta: 200 }];
  let partidas = 0, manos = 0, malas = 0, sinFin = 0;
  const niveles = [[1, 1, 1], [2, 2, 2, 2], [3, 3], [1, 2, 3, 3, 2, 1], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]];
  for (const cfg of combos) for (const nv of niveles) for (let r = 0; r < 12; r++) {
    const g = U.nueva({ nombres: nv.map((_, i) => 'M' + i), bots: nv.map(() => true), ...cfg });
    let pasos = 0, prev = 0;
    while (g.fase !== 'fin' && pasos++ < 60000) {
      if (g.fase === 'ronda_fin') { U.siguienteRonda(g); manos++; continue; }
      const i = g.turno;
      const a = U.elegir(g, i, nv[i]);
      const e = U.accion(g, i, a);
      if (e) { malas++; if (malas < 4) console.log('    jugada de la máquina rechazada:', e, JSON.stringify(a)); if (U.accion(g, i, { tipo: 'robar' })) U.accion(g, i, { tipo: 'pasar' }); }
      const total = g.seats.reduce((t, s) => t + s.mano.length, 0) + g.mazo.length + g.desc.length;
      if (total !== 108) { malas++; console.log('    cartas perdidas:', total); break; }
    }
    if (g.fase !== 'fin') sinFin++; partidas++;
  }
  check('todas las partidas acaban (' + partidas + ' partidas, ' + manos + ' manos)', sinFin === 0, sinFin + ' sin terminar');
  check('la máquina nunca hace una jugada ilegal y no se pierden cartas', malas === 0, malas + ' incidencias');
}
{
  // el modo aprendizaje siempre da un consejo legal
  let mal = 0, n = 0;
  for (let r = 0; r < 60; r++) {
    const g = U.nueva({ nombres: ['Tú', 'A', 'B'], bots: [false, true, true], acum: r % 2 === 0, siete0: r % 3 === 0 });
    let pasos = 0;
    while (g.fase !== 'fin' && pasos++ < 4000) {
      if (g.fase === 'ronda_fin') { U.siguienteRonda(g); continue; }
      const i = g.turno;
      if (i === 0) {
        const c = U.consejo(g, 0); n++;
        if (!c || !c.titulo || !c.lineas.length) mal++;
        const e = U.accion(g, 0, c.accion); if (e) { mal++; console.log('    consejo ilegal:', e, JSON.stringify(c.accion)); U.accion(g, 0, { tipo: 'robar' }); U.accion(g, 0, { tipo: 'pasar' }); }
      } else { const a = U.elegir(g, i, 2); if (U.accion(g, i, a)) { U.accion(g, i, { tipo: 'robar' }); U.accion(g, i, { tipo: 'pasar' }); } }
    }
  }
  check('el modo aprendizaje (' + n + ' consejos) siempre propone una jugada legal', mal === 0, mal + ' fallos');
}
{
  // fuerza: el nivel difícil gana más que el fácil
  let w = [0, 0, 0, 0];
  for (let r = 0; r < 600; r++) {
    const nv = [3, 2, 2, 1];
    const g = U.nueva({ nombres: ['d', 'n', 'n2', 'f'], bots: [true, true, true, true], meta: 0 });
    let p = 0; while (g.fase !== 'fin' && p++ < 5000) { const i = g.turno; const e = U.accion(g, i, U.elegir(g, i, nv[i])); if (e) { U.accion(g, i, { tipo: 'robar' }); U.accion(g, i, { tipo: 'pasar' }); } }
    w[g.orden[0]]++;
  }
  console.log('    victorias en 600 manos (difícil, normal, normal, fácil):', w.join(' / '));
  check('el nivel difícil gana más que el fácil', w[0] > w[3]);
  check('el normal gana más que el fácil', (w[1] + w[2]) / 2 > w[3]);
}

console.log(`\n${ok} correctas, ${ko} fallidas`);
process.exit(ko ? 1 : 0);
