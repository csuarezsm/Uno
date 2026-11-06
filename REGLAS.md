# Reglas del UNO de IT Canarias

Son las del UNO clásico (hoja de instrucciones de Mattel) más tres opciones de la casa. Esta es la especificación de `www/uno.js` y de sus pruebas (`tests/motor.test.mjs`).

## Fuentes consultadas

1. **Mattel, hoja de instrucciones oficial de UNO** (edición 30.º aniversario, con las reglas clásicas y las de dos jugadores): https://service.mattel.com/instruction_sheets/42885-0920_Uno_30th_Instr.pdf
2. **Official Game Rules, «Official UNO Rules»** (actualizado 2025; separa lo oficial de las reglas de la casa: no se acumula +2/+4, el +4 solo sin el color en juego, uno debe decir UNO él mismo): https://officialgamerules.org/game-rules/uno/ y https://www.officialgamerules.org/uno
3. **Wikipedia, «Uno (card game)»**, solo como apoyo de terminología y para confirmar que Mattel aclaró en 2019 que acumular no forma parte de las reglas estándar: https://en.wikipedia.org/wiki/Uno_(card_game)

Coinciden en lo esencial. Donde una app digital obliga a decidir algo, se indica en «Decisiones de diseño».

## Reglas aplicadas

- **Mazo**: 108 cartas. En cada color (rojo, amarillo, verde, azul): un 0, dos de cada número del 1 al 9, y dos Salta, dos Cambio de sentido y dos +2. Más 4 Comodines y 4 Comodines +4.
- **Jugadores**: de 2 a 10. Cada uno recibe **7 cartas**. Se vuelve la primera carta del mazo para empezar el descarte; empieza el jugador a la izquierda de quien reparte, en sentido horario.
- **Carta inicial de acción**: Salta → el primero pierde el turno; Cambio de sentido → el reparto cambia de sentido y empieza quien repartió; +2 → el primero roba 2 y pierde el turno; Comodín → el primero elige el color; **+4 → se devuelve al mazo** y se saca otra.
- **Turno**: se juega **una carta** del mismo color, número o símbolo que la de arriba, o un comodín. Si no se puede, se **roba una**: si sirve, puede jugarse; si no, se pasa. No se puede pasar sin robar.
- **Salta**: el siguiente pierde el turno. **Cambio de sentido**: se invierte el orden. **+2**: el siguiente roba 2 y pierde el turno. **Comodín**: se elige el color. **+4**: se elige color, el siguiente roba 4 y pierde el turno.
- **Dos jugadores**: Cambio de sentido funciona como Salta (se juega otra vez).
- **+4 solo si no tienes el color en juego** (puedes tener otros comodines). Quien lo recibe puede **desafiarlo**: si no era legal (tenía una carta del color anterior), roba 4 quien lo jugó y el desafiante no roba; si era legal, el desafiante roba **6** (4 + 2).
- **UNO**: al quedarte con una sola carta hay que decir UNO. Si otro jugador te pilla antes de que juegue el siguiente, robas **4** cartas (la hoja de Mattel; configurable a 2).
- **Fin de la mano**: gana quien se queda sin cartas (puede ser con un comodín). Si la última carta es un +2 o un +4, el siguiente roba antes de contar los puntos.
- **Puntos**: el ganador suma las cartas que quedan en las manos de los demás: números = su valor · Salta, Cambio de sentido y +2 = 20 · Comodines y +4 = 50. Gana la partida el primero que llega a **500** (opciones: 200, 1000 o una sola mano).
- **Mazo agotado**: se baraja el descarte (menos la carta de arriba) para formar un mazo nuevo.

## Opciones de la app (reglas de la casa, no oficiales)

- **Acumular +2 y +4**: si te ponen un +2 y tienes otro +2 (o un +4 sobre +4), lo devuelves y la cuenta suma. Por defecto, desactivado (es lo oficial). Con acumulación no se puede desafiar el +4.
- **Regla del 7 y el 0**: un 7 cambia tu mano por la de otro jugador a tu elección; un 0 hace pasar todas las manos en el sentido del juego. Por defecto, desactivada.
- **Castigo por no decir UNO**: 4 cartas (Mattel) o 2.

## Decisiones de diseño

- **Botón ¡UNO!**: en un juego digital no se puede «decir» en voz alta. Con dos cartas en la mano aparece el botón; si se pulsa antes de jugar la penúltima carta, quedas a salvo. Si no, quedas expuesto hasta que juegue el siguiente jugador: cualquiera puede pulsar «¡Pillar!» y tú puedes decir UNO a tiempo. La máquina espera un poco antes de actuar para dar margen.
- **Sin «saltar a la jugada»** (jugar fuera de turno con una carta idéntica): no está en la hoja básica y es muy difícil de hacer justo en línea.
- **Nombre**: la app se llama UNO como el juego, pero es independiente de IT Canarias, no está afiliada a Mattel y no usa su diseño de cartas. «UNO» es marca registrada de sus propietarios (ver la nota de Google Play en `play-store/FICHA-GOOGLE-PLAY.md`).
- **Desempates de la clasificación final**: más puntos; en una sola mano, menos puntos en la mano; después, el orden de mesa.
- **Máquina**: tres niveles. Fácil: juega al azar y a veces olvida el UNO. Normal: guarda los comodines, ataca cuando al siguiente le quedan pocas cartas y a veces pilla. Difícil: además cuenta los colores que han fallado los demás y desafía con probabilidades.
- **En línea**: el servidor baraja con números aleatorios criptográficos; cada jugador solo recibe sus cartas. Si pasa el tiempo del turno (20/40/60 s), roba y pasa solo.
