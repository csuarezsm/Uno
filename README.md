# UNO

El juego de cartas de colores para Android e iPhone: **contra la máquina** (3 niveles) o **en línea con amigos**, con **modo aprendizaje**.
App Capacitor + web (`www/`). Todos los datos se guardan en el móvil; solo el juego en línea usa el servidor de juegos (nombre y jugadas, sin guardarlos).
Paquete: `com.itcanarias.uno` · versión 1.0.0

**iPhone y navegadores**: la misma app se publica como versión web instalable en https://csuarezsm.github.io/Uno/app/ (GitHub Pages, carpeta `docs/app`, copia de `www/`). En Safari: Compartir → «Añadir a pantalla de inicio». Tras cambiar `www/`, ejecuta `npm run web` antes del commit (el workflow lo comprueba).

© 2026 IT Canarias. Todos los derechos reservados. App independiente: no está afiliada a Mattel; UNO® es marca de sus propietarios. Diseño de cartas propio.

Hecha con la misma plantilla que Ajedrez, Damas, Chinchón, Pumba, Parchís y Póker (tema por defecto: noche azul). Las reglas, con sus fuentes, están en [REGLAS.md](REGLAS.md).

## Qué hace

- **Reglas oficiales de UNO** (108 cartas, 7 por jugador, +4 solo sin el color en juego con desafío, UNO y «pillar») y partida a 500 puntos (también 200, 1000 o una mano).
- **Opciones**: acumular +2/+4, regla del 7 y el 0, castigo de 4 o 2 cartas por no decir UNO.
- **Contra la máquina**: de 1 a 9 rivales y tres niveles (fácil, normal y difícil).
- **En línea con amigos**: hasta 10 personas, cada una en su móvil, con el servidor común (`wss://juegos.itcanarias.com/ws`, repo `csuarezsm/juegos-servidor`, juego `uno`). Crear partida y pasar el código por WhatsApp, partidas públicas, la máquina puede ocupar sillas libres y juega por quien se desconecta; reloj de turno (20/40/60 s) y revancha. El mazo lo baraja el servidor y cada uno solo recibe sus cartas.
- **💡 Modo aprendizaje**: muestra tu mano por colores y puntos, y con «¿Qué hago?» explica qué cartas puedes jugar, cuál conviene y por qué; resalta la carta o el botón aconsejado. **Nunca juega por ti.** Los consejos están en español en todos los idiomas.
- Historial y estadísticas, copia de seguridad (exportar/importar, copia automática en Android), temas, tamaño de letra, sonidos sintetizados, aviso de turno, actualizador del APK, compartir la app, idiomas (ES, EN, FR, DE, IT) y borrar datos.

## Archivos

| Archivo | Contenido |
| --- | --- |
| `www/uno.js` | Reglas y máquina (el **mismo archivo** va en el servidor: `juegos-servidor/motores/uno/uno.js`). Mazo, jugadas, UNO y pillar, desafío, acumulación, 7-0, puntos, bots por niveles y consejos. |
| `www/juego.js` | Mesa, mano, modo aprendizaje, partida contra la máquina y cliente en línea. |
| `www/index.html` | Estilos, menú, temas, historial, copia de seguridad, actualizador y arranque. |
| Archivos comunes | `idioma.js` + `i18n-*.js`, `masjuegos.js`, `turno.js`, `audio-suave.js`, `contador.js`, `invitacion.js`, `publicas.js`: idénticos en todas las apps. |
| `tests/motor.test.mjs` | Pruebas del motor: mazo, reparto, reglas, +4 y desafío, acumulación, UNO y pillar, puntos, 7-0, simulaciones con todas las opciones, consejos y fuerza de los niveles. |
| `tests/app.test.mjs` | Pruebas de la interfaz (móvil, horizontal, tablet), partidas completas, jugadas una a una, copias y juego en línea contra una copia local del servidor. |

## Desarrollo

```
npm ci
npm test            # motor + interfaz (necesita Chrome o Playwright; en línea usa ../juegos-servidor)
npm run web         # copia www/ a docs/app/
npm run icons       # genera los iconos de Android desde assets/
```
Publicar: sube `versionCode`/`versionName` en `android/app/build.gradle`, `APP_VERSION` en `www/index.html`, `CACHE` en `www/sw.js` y `version` en `package.json`; `npm run web`; commit y push a `main`. El workflow compila, firma y crea la Release.
