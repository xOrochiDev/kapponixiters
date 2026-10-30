# AlkaponeDollar

Panel web de administración de productos, policies, licencias, activaciones, tokens de producto y actividad Keygen. Construido con Expo Router/React Native Web, TypeScript, Express y tRPC; Keygen se consulta únicamente desde el servidor.

## Desarrollo

- Requiere Node.js compatible con Expo y pnpm 9.12.0 (versión fijada en `package.json`).
- Instala dependencias con `pnpm install`.
- Configura una base de datos propia de desarrollo antes de `pnpm db:push`; no ejecutes migraciones contra una base de datos de producción sin revisar su destino.
- Inicia web y API con `pnpm dev` (Metro/Web en 8081 y API en 3000). También existen `pnpm check`, `pnpm lint` y `pnpm test`.
- El login Manus OAuth y la sesión del propietario dependen de la configuración de Manus; al ejecutar fuera de Manus se deben configurar los servicios de autenticación y persistencia para ese entorno.

## Configuración de Keygen

El servidor espera `KEYGEN_ACCOUNT_ID` y `KEYGEN_API_TOKEN`. El acceso de propietario también puede usar `PANEL_OWNER_EMAIL` o `OWNER_OPEN_ID`, según el despliegue. Define estos valores en el gestor de secretos del entorno de ejecución; no los pongas en el código, en el ZIP, en capturas ni en un repositorio. `.env.example` solo enumera nombres vacíos. No reutilices credenciales de producción en una máquina de desarrollo compartida.

El API token de Keygen no debe exponerse al navegador ni incluirse en una aplicación cliente distribuida. Si un secreto se pierde o se comparte, revócalo y genera uno nuevo en Keygen.

## Arquitectura

- `app/`: navegación web, inicio de sesión y formularios del panel.
- `components/keyforge/`: secciones de aplicaciones, licencias, seguridad, actividad y monitoreo.
- `server/keygen.ts`: cliente JSON:API con sanitización de respuestas.
- `server/routers/keygen.ts`: procedimientos tRPC protegidos.
- `docs/keygen-integration.md`: decisiones de integración y comportamiento de autenticación.
