## Mini‑documentación: JWT con backend y frontend desacoplados

### Checklist de lo que se hizo 

- Infra/Docker
  - Docker Compose con dos servicios: Django (8000) y React/Vite (5173). 
  - EntryPoint del backend ajustado para SQLite (sin contenedor de DB). 
  - Variables de entorno (.env) y SECRET_KEY unificado. 

- Backend (Django + DRF)
  - Documentación con drf-spectacular: `/api/schema/`, `/api/docs/`, `/api/redoc/`. 
  - Botón “Authorize” en Swagger con esquema Bearer (JWT) y `persistAuthorization`. 
  - Autenticación JWT propia (PyJWT): emisión de access y refresh tokens. 
  - Validaciones JWT: `iat`/`exp` numéricos, `sub` como string, `leeway`, manejo de errores. 
  - Autenticación por defecto: `JWTAuthentication`. 
  - Permisos por defecto: `IsAuthenticated` (todo protegido). 
  - Endpoints de auth públicos (AllowAny): `/api/auth/login`, `/register`, `/refresh`, `/whoami`. 
  - Extensión OpenAPI para JWT custom (sin warnings). 
  - Ajuste del modelo `User` para que DRF reconozca `is_authenticated`. 

- Frontend (React + Vite)
  - Cliente Axios con interceptor: 
    - Envía `Authorization: Bearer <access>`. 
    - Auto-refresh en 401 usando `/api/auth/refresh`. 
  - `AuthContext` con persistencia en `localStorage`. 
  - Integración de la pestaña Summary consumiendo `/api/documents/{id}/summary/`. 

- Seguridad/DevX
  - CORS y CSRF configurados para el dev server (5173). 
  - Swagger “Authorize” funcional para probar endpoints protegidos. 
  - `whoami` expuesto para depuración (opcional cerrarlo después). 

---

### Por qué JWT en proyectos frontend y backend separados 

- Stateless y escalable
  - El backend no mantiene sesiones en memoria/DB; valida el token en cada request. 
  - Facilita el escalado horizontal y el uso de gateways/CDN. 

- Desacoplamiento real
  - El API sirve a múltiples clientes (web, mobile, CLI) sin compartir estado de sesión. 
  - Menos acoplamiento a mecanismos de sesión/cookies del servidor. 

- Simplicidad del cliente SPA
  - El frontend solo añade un header `Authorization: Bearer <access>`. 
  - Evita muchos problemas de CSRF típicos de cookies de sesión (con Bearer y JSON puro). 
  - CORS controlado explícitamente; sin necesidad de enviar credenciales de sesión. 

- Interoperabilidad y estándar
  - JWT es ampliamente soportado, portable entre servicios y fácil de integrar en proxies/API gateways. 
  - Claims auto-contenidas: quién es el usuario (`sub`), tiempos (`iat`/`exp`), tipo (access/refresh). 

- Seguridad bien entendida
  - Access tokens cortos limitan el impacto en caso de exfiltración. 
  - Refresh tokens permiten renovar sin re-loguear, con controles de rotación/revocación. 

---

### Cómo lo aplicamos aquí 

- Emisión de tokens
  - Al login/register devolvemos: 
    - `access`: expira aprox. en 60 min. 
    - `refresh`: expira aprox. en 7 días. 
  - Claims: `sub` (string, id de usuario), `iat`, `exp`, `type` (access|refresh). 

- Validación en backend
  - `JWTAuthentication` decodifica el access, convierte `sub` a int, carga el `User`. 
  - DRF exige `IsAuthenticated` por defecto; si falta o es inválido → 401/403. 

- Flujo en frontend
  - Guardamos tokens en `localStorage` para simplicidad. 
  - Interceptor Axios añade `Authorization` en cada request. 
  - Si hay 401 por expirar, intenta refresh y reintenta la llamada. 
  - Si falla refresh, se cierra sesión (limpia storage). 

- Swagger
  - “Authorize” (bearerAuth) para pegar el access token y probar endpoints protegidos. 
  - Endpoints de auth quedan sin seguridad para poder iniciar sesión desde la UI. 

---

### Buenas prácticas recomendadas 

- Transporte seguro
  - Siempre HTTPS en producción. 
  - No expongas tokens en URLs o logs. 

- Vida útil y rotación
  - Access tokens cortos; refresco con rotate-and-revoke en server si incrementas seguridad. 
  - Opción: lista de revocación (`jti`) si necesitas invalidarlos antes del `exp`. 

- Almacenamiento de tokens
  - `localStorage` es práctico pero sensible a XSS; mitiga con CSP, sanitización, y auditorías. 
  - Alternativa: cookies `httpOnly` + `SameSite=strict` (implica lidiar con CSRF y CORS). 

- Gestión de secretos
  - `SECRET_KEY` vía entorno, estable y con rotación planificada. 
  - Sin comillas en `.env`; tiempo del host y contenedores sincronizado. 

- Errores y semántica
  - 401 para token faltante/expirado/inválido; 403 para falta de permisos. 
  - Alinea claims con librerías (p. ej., PyJWT requiere `sub` como string). 

- Documentación y DX
  - Mantén Swagger actualizado; usa examples y response schemas. 
  - Bloquea `whoami` en producción si no es necesario. 

---

### Flujos clave (resumen) 

- Login
  - `POST /api/auth/login` → access + refresh → frontend guarda y comienza a enviar Bearer. 

- Auto-refresh
  - Si 401: `POST /api/auth/refresh` con refresh → recibe nuevos tokens → reintenta request. 

- Logout
  - Elimina tokens del storage; opcional: revocar refresh (si implementas lista de revocación). 
