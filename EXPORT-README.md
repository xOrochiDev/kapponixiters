# Kapponi V.10 Panel — paquete exportado

Incluye el código fuente del panel, integración server-side con Keygen, API Android, monitoreo de APK/webapps, mantenimiento, avisos remotos, Dockerfile, migraciones y documentación.

## Configurar Keygen de forma segura

El token real no está incluido en este ZIP. Carga las variables en el servidor:

```bash
cp .env.example .env
# Edita .env solo en el servidor
KEYGEN_ACCOUNT_ID=tu-account-id
KEYGEN_API_TOKEN=tu-token-privado
```

No pongas el token en la APK, en `EXPO_PUBLIC_*`, en el navegador ni en Git.

## Arranque

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build:web
pnpm dev:server
```

Para conectar otra app usa un `appSlug` propio y los endpoints documentados en `server/_core/index.ts`: configuración pública, registro y heartbeat. No se puede conectar una app sin conocer su slug, plataforma y endpoint/credenciales de integración.
