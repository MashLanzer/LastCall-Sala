# LAST CALL — Sala de escucha (web)

Web estática en GitHub Pages: https://mashlanzer.github.io/LastCall-Sala/

La sala privada de LAST CALL: el catálogo completo de tomas de Suno (161) con
las marcas de Brayan (Me gusta / No me gusta / A producción / Ya escuché),
buscador, progreso de escucha, cola de producción y notas por canción.
Reemplaza en el uso diario al espacio `sala-de-escucha-last-call`, que queda
como respaldo.

## Archivos

- `index.html`, `styles.css`, `script.js` — la web (sin frameworks).
- `catalogo.json` — catálogo de canciones y tomas (ids, duraciones, enlaces
  de Suno). Generado desde el espacio con `tools/extraer-catalogo.py`.
- `decisiones.json` — **fuente de verdad compartida de las marcas**:
  `{take_id: {like, dislike, produccion, escuchada, nota, ts}}` más la clave
  especial `_notas` con las notas por canción (`{grupo: {nota, ts}}`).
  Zora lee este archivo para «revisa last call».
- `portada-sleep-tight.jpg`, `portada-wide-awake.jpg` — portadas publicadas.

## Sincronización

Al cargar, la web lee `decisiones.json` de este repo y lo fusiona con lo
guardado en el navegador (gana la marca con `ts` más reciente). Al marcar,
guarda en `localStorage` y, si Brayan configuró su token de GitHub en
«Conectar sincronización», hace commit de `decisiones.json` vía la API de
GitHub. El token vive solo en el `localStorage` de su navegador. Sin token,
la web funciona igual en local y permite exportar/importar el JSON.

## Reglas de listas

- **Publicadas**: todas las tomas de canciones publicadas.
- **Me gusta**: tomas no publicadas con `like`.
- **En producción**: tomas no publicadas con `produccion` (tengan o no like;
  es también la cola de producción, en orden de catálogo).
- **Producidas sin publicar**: no publicadas y sin ninguna marca.
- «Ya escuché» sin like, o «No me gusta», saca la toma de todas las listas,
  pero la marca queda guardada en `decisiones.json`.
