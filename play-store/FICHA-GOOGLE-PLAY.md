# UNO · Ficha de Google Play

Paquete: `com.itcanarias.uno` · Archivo para subir: `uno-play.aab` (en la Release de GitHub) · Desarrollador: IT Canarias

Las imágenes de esta carpeta se generan con `node play-store/capturas.mjs`.

> ⚠️ **Riesgo de marca**: «UNO» es una marca registrada de Mattel. Google Play puede rechazar o retirar una app llamada «UNO» de otro desarrollador (política de suplantación y propiedad intelectual), aunque las reglas sean las del juego y el diseño sea propio. Opciones si ocurre: (1) renombrar el título de la ficha a algo propio, p. ej. «Cartas de colores» o «Uno Canarias», sin tocar el paquete; (2) mantener la app solo en GitHub/iPhone. En la ficha no se usa el logotipo ni el estilo gráfico de Mattel, y se dice que la app es independiente.

## Recursos gráficos

| Archivo | Uso en Play Console |
| --- | --- |
| `icono-512.png` | Icono de la aplicación (512×512) |
| `grafico-destacado-1024x500.png` | Gráfico destacado |
| `movil-1…5.png` (1080×1920) | Capturas de teléfono (de 2 a 8) |
| `tablet7-1…5.png` (1200×1920) | Capturas de tablet de 7" |
| `tablet10-1…5.png` (1920×1200) | Capturas de tablet de 10" |

Orden recomendado: 1-partida, 2-aprendizaje, 3-inicio, 4-final, 5-historial.

## Ficha principal

**Nombre de la aplicación** (máx. 30)
UNO

**Descripción breve** (máx. 80)
Cartas de colores contra la máquina o en línea con amigos. Con modo aprendizaje.

**Descripción completa**

El juego de cartas de colores de toda la vida: quédate sin cartas antes que los demás. Contra la máquina o en línea con tus amigos, cada uno en su móvil. Sin anuncios y sin cuentas.

🃏 LAS REGLAS DE SIEMPRE
• 7 cartas cada uno, Salta, Cambio de sentido, +2, Comodín y Comodín +4 (solo si no tienes el color en juego, y se puede desafiar).
• ¡Di UNO! Si te olvidas y te pillan, robas cartas de castigo. ¡Tú también puedes pillar!
• Partida a 500 puntos (o 200, 1000 o una sola mano).
• Opciones: acumular +2 y +4, regla del 7 y el 0 y castigo de 2 o 4 cartas.

🤖 CONTRA LA MÁQUINA
• De uno a nueve rivales y tres niveles: fácil, normal y difícil.

💡 MODO APRENDIZAJE
• Te explica qué cartas puedes jugar, cuál conviene y por qué, y te recuerda decir UNO.
• Nunca juega por ti: tú decides.

🌐 EN LÍNEA CON AMIGOS
• Hasta 10 jugadores: crea una partida, comparte el código por WhatsApp y rellena las sillas libres con la máquina.
• El servidor baraja y reparte; nadie ve tus cartas. Si alguien se desconecta, la máquina juega por él hasta que vuelve.

📊 HISTORIAL
• Tus partidas, victorias y podios, con copia de seguridad.

✨ A TU GUSTO
• Temas de colores, velocidad de la máquina, tamaño de letra y sonidos.
• Funciona en vertical, en horizontal y en tablet, y en español, inglés, francés, alemán e italiano.

🔒 SIN ANUNCIOS Y SIN RECOGER DATOS
No hay cuentas ni registro, no lleva anuncios ni rastreadores y tus partidas se guardan solo en tu móvil.

Juego de entretenimiento sin apuestas. App independiente desarrollada en Lanzarote por IT Canarias; no está afiliada a Mattel. UNO® es marca de sus propietarios.

## Datos de la ficha

| Campo | Valor |
| --- | --- |
| Tipo | Juego |
| Categoría | Cartas |
| Etiquetas | Cartas, Multijugador, Familia, Clásicos |
| Correo de contacto | [correo de contacto de IT Canarias] |
| Sitio web | https://itcanarias.com |
| Política de privacidad | https://csuarezsm.github.io/Uno/privacidad.html |
| Precio | Gratis |

## Contenido de la aplicación (formularios)

| Formulario | Respuesta |
| --- | --- |
| Política de privacidad | La URL de arriba (hay que activar GitHub Pages) |
| Acceso a la aplicación | Todas las funciones están disponibles sin restricciones |
| Anuncios | No contiene anuncios |
| Clasificación de contenido | Categoría «Juego». Violencia, sexo, lenguaje, drogas, apuestas: No. Interacción entre usuarios: **Sí** (se juega en línea con otras personas; no hay chat, solo el nombre y las jugadas). Compartir ubicación: No |
| Público objetivo | 13 años o más (o todas las edades si se acepta la política de Familias; no hay chat ni compras) |
| Seguridad de los datos | Juego en línea: **Sí recoge** → «Información personal: Nombre», marcado como *se procesa de forma efímera*, *no se comparte*, *opcional* (solo si se juega en línea), finalidad «Funciones de la aplicación». Se cifra en tránsito: **Sí**. Borrar datos: no se guardan en el servidor; los del móvil se borran desde ⋮ → Borrar datos. Nada más (ni ubicación, ni identificadores, ni analíticas) |
| Aplicación gubernamental | No |
| Funciones financieras | Ninguna |
| Salud | Ninguna |
| Permisos | Solo `INTERNET`. El permiso de instalar paquetes va solo en la versión de GitHub, no en el AAB de Play |

## Versión

- Nombre de la versión: el mismo que la Release (por ejemplo, 1.0.0).
- Notas: copia la primera línea del commit de la Release.

## Firma

Play App Signing activado (opción por defecto). La clave de subida es `uno-release.jks` (alias `uno`), la misma que firma el APK de GitHub.

## Cuenta

- Cuenta personal: prueba cerrada con 12 testers durante 14 días seguidos antes de producción.
- Cuenta de organización (con número D-U-N-S): sin ese requisito.

© 2026 IT Canarias. Todos los derechos reservados.
