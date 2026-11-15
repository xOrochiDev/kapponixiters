# Frontend GitHub Pages + backend Manus

El repositorio contiene un workflow en `.github/workflows/deploy-pages.yml` que publica la interfaz web en GitHub Pages. El backend Express/tRPC, las sesiones y el acceso a Keygen permanecen en Manus; el token privado de Keygen nunca se incluye en el bundle web.

## Configuración

1. Publica primero el proyecto completo desde Manus y copia la URL HTTPS estable del backend.
2. En GitHub abre **Settings → Secrets and variables → Actions → Variables**.
3. Crea la variable de repositorio `MANUS_API_BASE_URL` con esa URL, sin `/` al final. Ejemplo: `https://panel-backend.example`.
4. En **Settings → Pages**, selecciona **GitHub Actions** como fuente.
5. Ejecuta el workflow **Deploy web frontend to GitHub Pages** o haz push a `main`.

El workflow detiene el despliegue si `MANUS_API_BASE_URL` no está configurada, evitando publicar una interfaz que no pueda iniciar sesión. La sesión de licencia se conserva en el almacenamiento local del navegador y se envía al backend mediante el esquema `Authorization: License ...`; esto evita depender exclusivamente de cookies de terceros.

## URL esperada

Para este repositorio, GitHub Pages normalmente usará una URL como `https://xorochidev.github.io/kapponixiters/`. GitHub puede mostrar otra variante según la configuración de Pages o un dominio personalizado.

GitHub Pages no ejecuta Node.js, Express, tRPC ni la base de datos. CORS en Manus acepta explícitamente `https://xorochidev.github.io`; no se permite cualquier origen arbitrario de `github.io`.

## Seguridad

`KEYGEN_ACCOUNT_ID` y `KEYGEN_API_TOKEN` permanecen como secretos del backend Manus. `MANUS_API_BASE_URL` no es un secreto: se incorpora al frontend porque el navegador necesita saber a qué API enviar sus solicitudes. La URL del backend puede ser visible en las herramientas de red del navegador, pero sus credenciales privadas no.
