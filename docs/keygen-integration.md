

## Login de referencia y validación de licencias

La pantalla solicitada toma como guía la captura IMG_8116.png enviada por el usuario: nombre de usuario, clave de licencia, retrato circular, fondo oscuro y verificación con Keygen. Según la [documentación oficial de Licenses](https://keygen.sh/docs/api/licenses/), Keygen expone `POST /licenses/actions/validate-key` sin autenticación obligatoria y recibe `{ "meta": { "key": "…", "scope": { "user": "UUID-o-email" } } }`; la respuesta incluye `meta.valid` y el recurso de licencia. El servidor solo interpreta ese booleano, nunca devuelve la licencia ni la clave al navegador, y el endpoint de login limita intentos por IP. Si el nombre de usuario tiene formato de email o UUID, se usa como `scope.user`; nombres simples no se mandan como identidad de Keygen.

Una licencia válida de cliente no concede privilegios de administración. Después de validarla, el panel conserva la sesión OAuth/allowlist del propietario; Keygen sigue aceptando cambios administrativos solo desde rutas servidor protegidas. La API de usuario de Keygen que genera tokens de licensee (Basic auth email/password) no es un sustituto del acceso administrativo de la cuenta.

La referencia de token de producto confirma que `expiry` es un timestamp ISO 8601 opcional, que `permissions` debe ser una lista explícita y que el secreto es visible solo inmediatamente después de la creación. Los tokens de producto se listan sin sus secretos.
