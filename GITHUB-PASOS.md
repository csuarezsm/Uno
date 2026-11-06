# Qué tienes que hacer en GitHub (paso a paso)

Todo el trabajo está hecho y subido por mí. Solo faltan los pasos que necesitan tu cuenta. Cuenta de GitHub: `csuarezsm`. Repositorio de la app: **Uno** (ya existe).

## 1 · Secretos de firma (una sola vez)

1. Repositorio **Uno** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Crea dos secretos:
   - `ANDROID_KEYSTORE_BASE64` → pega todo el contenido del archivo `uno-keystore-base64.txt` que te envío en el chat (una sola línea larga).
   - `ANDROID_KEYSTORE_PASSWORD` → la contraseña que te doy en el chat.
3. Guarda a salvo `uno-release.jks` (alias `uno`) y la contraseña: si se pierden no podrás actualizar la app instalada.
4. Cuando termines, borra el `.txt` de base64 del ordenador.

## 2 · GitHub Pages (iPhone, descarga y privacidad)

1. Repositorio **Uno** → **Settings** → **Pages**.
2. *Source*: **Deploy from a branch** → Branch **main** → carpeta **/docs** → *Save*.
3. En 1–2 minutos funcionan https://csuarezsm.github.io/Uno/ (descarga), https://csuarezsm.github.io/Uno/app/ (app web para iPhone) y https://csuarezsm.github.io/Uno/privacidad.html.

## 3 · Primera versión (APK)

1. Pestaña **Actions** → workflow *Android* → **Re-run all jobs** (la primera vez falla por falta de secretos).
2. Tarda 8–12 minutos: pasa las pruebas, compila, firma y crea la Release **v1.0.0**.
3. Pestaña **Releases**: deben estar `uno.apk` y `uno-play.aab`.
4. Android: abre https://csuarezsm.github.io/Uno/ en **Chrome** → «Descargar para Android». iPhone: abre `…/Uno/app/` en Safari → Compartir → «Añadir a pantalla de inicio».

## 4 · Servidor en línea (VPS)

El servidor ya tiene el UNO en GitHub (`juegos-servidor`). Para que «En línea» funcione hay que actualizar el VPS **cuando tú lo decidas**:
`cd /opt/juegos-servidor && git pull && bash despliegue/instalar-vps.sh`
Sin eso, la app funciona contra la máquina y «En línea» dirá que estará disponible pronto.

## 5 · Poker: cambiar el nombre del repositorio

Para que su icono salga en «Más juegos», renombra `poker` → `Poker` en GitHub (Settings → Repository name). GitHub redirige el nombre antiguo.

## 6 · Google Play (opcional)

Usa `play-store/FICHA-GOOGLE-PLAY.md` y las imágenes de esa carpeta. Ojo: «UNO» es marca de Mattel y Play puede rechazar el nombre; el documento explica la alternativa.
