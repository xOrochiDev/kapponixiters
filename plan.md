# Plan — AlkaponeDollar

## Objetivo y alcance

Crear un panel **web** personal, inspirado en la consola de Keygen, para administrar aplicaciones, policies, licencias, activaciones y actividad de auditoría. La experiencia funciona en el navegador y se adapta a escritorio y móvil; no se generan builds nativos.

La identidad visual toma la misma foto, el nombre **AlkaponeDollar**, el fondo negro/gris y la navegación lateral de la app de transcripciones del usuario. La pantalla de acceso conserva esa identidad y la mejora para el panel. La sesión de propietario usa Manus OAuth y el token de Keygen se usa únicamente desde el backend: iniciar sesión en el panel y autorizar llamadas a Keygen son funciones separadas.

## Diseño

- **Movimiento:** consola oscura de desarrollador, basada en la referencia de paneles de licensing y en el lateral de AlkaponeDollar.
- **Principios:** doble nivel de navegación fácil de recorrer; información densa pero escaneable; mismo lenguaje visual que la app fuente; acciones remotas explícitas y seguras.
- **Color:** negro profundo y grafito como base; grises claros para contraste y acción primaria; estados de advertencia en tonos neutros de mayor contraste, sin acentos brillantes que compitan con los datos.
- **Paradigma de layout:** rail angosto de iconos más una barra lateral ancha con espacio de trabajo, búsqueda, categorías, favoritos y estado Keygen; el área principal muestra módulos operativos. En pantallas pequeñas el lateral se convierte en un drawer.
- **Elementos distintivos:** foto original de AlkaponeDollar como retrato de acceso y avatar; categorías Gestión/Monitoreo/Conexiones con estrellas de favorito; chips sobrios de estado Keygen.
- **Interacción y animación:** navegación inmediata, búsqueda local, favoritos conmutables y formularios conectados; confirmar antes de desactivar una máquina; transiciones cortas y discretas, sin movimiento ornamental.
- **Tipografía:** sans del sistema para la interfaz y monoespaciada para claves o identificadores técnicos.
- **Esencia de marca:** consola privada de AlkaponeDollar para controlar licencias de software en un solo lugar. Personalidad: directa, seria y técnica.
- **Voz:** mensajes breves y funcionales. Ejemplos: «Tus aplicaciones. Tus reglas.» y «Keygen conectado desde el servidor.»
- **Wordmark y foto:** wordmark AlkaponeDollar con la misma foto proporcionada por el usuario, no un símbolo genérico sustituto.
- **Color insignia:** gris claro sobre grafito, usado para selección y acciones primarias.

## Arquitectura y estructura

- `app/(tabs)/index.tsx`: entrada web, login, shell, navegación, consultas/mutaciones y formularios del panel.
- `components/keyforge/sections.tsx`: resumen, aplicaciones, licencias, policies, activaciones, seguridad, actividad, conexión y ajustes.
- `server/keygen.ts`: cliente HTTP JSON:API de Keygen, credenciales server-only, minimización de actividad y tratamiento de errores.
- `server/routers/keygen.ts`: procedimientos protegidos para estado, productos, policies, licencias, activaciones y Event Logs.
- `server/routers.ts`: registro del router.
- `server/_core/`: sesión OAuth del panel, cookie de Preview y restricción de acceso al propietario.
- `drizzle/`: persistencia de la cuenta que usa el starter para autenticación; Keygen sigue siendo la fuente de verdad de los productos y licencias.
- `assets/images/alkapone-avatar.jpeg` y sus variantes: foto de referencia en el login, navegación, favicon e identidad del proyecto.
- `public/manus-routes.json`: declaración de la ruta de página `/` del preview web.
- `docs/keygen-integration.md`: decisiones de integración y referencia oficial de Keygen.
- `Dockerfile`: runtime de producción de la API, separado del bundle web estático.

## Comportamiento y seguridad

El runtime enlazado ofrece el preview web en el puerto 8081 y la API en el 3000. Se conserva la base de datos y la sesión del starter. El acceso administrativo es exclusivo de la cuenta propietaria configurada; el servidor compara la identidad OAuth con la lista de acceso.

La entrega web usa bundle estático para la interfaz y contenedor para `/api/*`, con cookies de sesión `SameSite=None; Secure` en producción HTTPS. La configuración PWA queda en modo administrado por la plataforma y usa el avatar de AlkaponeDollar como logo; el layout móvil prioriza drawer, safe areas, targets táctiles y modales que no desbordan la pantalla.

La API real consulta y crea productos, consulta policies, emite licencias mediante una policy existente, suspende/reactiva licencias, lista y desactiva máquinas con confirmación, y consulta hasta 100 Event Logs recientes cuando Keygen permite `event-log.read`. El cliente recibe claves enmascaradas salvo la clave recién generada, mostrada en su confirmación; no recibe metadata sensible de eventos ni el token de Keygen. Si Event Logs Beta o el permiso faltan, el panel presenta una explicación sin simular actividad real.
