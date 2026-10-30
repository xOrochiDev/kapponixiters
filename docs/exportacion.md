# Exportación segura

La distribución del proyecto debe incluir el código fuente, assets, documentación y lockfile de pnpm. No debe contener `.env` con valores reales, sesiones OAuth, tokens de Keygen, tokens de producto ni otros secretos. Los valores almacenados por Manus como secretos protegidos no se recuperan ni se copian a archivos del proyecto.

El archivo raíz `.env.example` enumera nombres de variables vacíos. Configura `KEYGEN_ACCOUNT_ID`, `KEYGEN_API_TOKEN` y la allowlist del propietario directamente en el gestor seguro del entorno que ejecuta el backend. La sesión Manus OAuth y la base de datos requieren su propia configuración en el entorno destino; no son portables dentro de un ZIP de código.

Antes de compartir un archivo de configuración local, comprueba que no contenga valores sensibles y conserva los archivos `.env*` fuera de Git. Si se filtra un token, revócalo en Keygen y emite uno nuevo.
