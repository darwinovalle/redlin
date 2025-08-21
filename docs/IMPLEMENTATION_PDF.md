# Documentación: Visor PDF y panel de estudio (Flashcards/Review/Quiz/Summary)

Fecha: 2025-08-18

Resumen
- Esta implementación añade un visor PDF central en la UI y un panel de estudio a la derecha (Flashcards / Review / Quiz / Summary) con layout compacto (sin huecos superiores).
- Arquitectura: frontend React (Vite + MUI + react-pdf), backend Django REST Framework (DRF) con endpoint protegido para servir PDFs.
- Funcionalidades principales: renderizado de PDF, zoom, selección y copia de texto, resaltado in-memory (local), barra de estudio con pestañas centradas, streaming seguro de archivos PDF desde Django.

Arquitectura y decisiones clave
- Frontend:
  - Librería para renderizar PDFs: `react-pdf` + `pdfjs-dist`.
  - Worker: se importa el worker localmente vía `.mjs?url` para evitar CORS con CDN y para asegurar compatibilidad entre versiones.
  - Estado del visor separado: `ViewerContext` (reducer) maneja escala (zoom), página activa, número de páginas, modo de resaltado.
  - Componentes principales:
    - `src/components/PdfViewer/PdfViewer.jsx`: componente que carga `Document` y `Page` de `react-pdf`, renderiza capas de texto/selección y overlay de highlights.
    - `src/components/PdfViewer/PdfToolbar.jsx`: controles (zoom in/out/reset, toggle highlight mode).
    - `src/components/PdfViewer/ViewerContext.jsx`: context/reducer para estado de visor.
  - Integración en layout: `src/pages/Dashboard/index.jsx` coloca el visor en el centro y el panel de estudio (width: 700px) a la derecha; las pestañas (Tabs) están centradas en la franja superior del panel.
  - Servicios API: `src/services/api/index.jsx` tiene `documentService.getPdfUrl()` y axios baseURL lee `import.meta.env.VITE_API_URL`.

- Backend (Django + DRF):
  - Endpoint para servir el PDF: `GET /api/documents/{id}/file/` ubicado en `redlin_web/API/views.py` (action `file`).
  - Seguridad: se verifica propietario/autorización (JWT personalizado) antes de devolver el archivo.
  - En caso de que el archivo no exista en `MEDIA` (migración/seeded files), la vista hace fallback al directorio `redlin_web/documents/` y sirve el archivo desde allí.
  - Dev: `MEDIA_URL` y `MEDIA_ROOT` añadidos en `redlin_web/redlin_web/settings.py` y `redlin_web/redlin_web/urls.py` sirve `static()` cuando `DEBUG=True`.

Ficheros y rutas importantes (delta de implementación)
- Frontend (redlin-front):
  - `src/components/PdfViewer/PdfViewer.jsx` — visor, worker import, overlays.
  - `src/components/PdfViewer/PdfToolbar.jsx` — barra de herramientas (zoom, highlight).
  - `src/components/PdfViewer/ViewerContext.jsx` — estado compartido del visor.
  - `src/pages/Dashboard/index.jsx` — integró el visor en layout central y panel derecho con Tabs centradas.
  - `src/services/api/index.jsx` — documentService y uso de `VITE_API_URL`.
  - `.env.example` — documentar `VITE_API_URL` (frontend necesita variables con prefijo VITE_).

- Backend (redlin_web):
  - `redlin_web/API/views.py` — `DocumentViewSet.file()` action para streaming (FileResponse) con fallback.
  - `redlin_web/redlin_web/settings.py` — `MEDIA_URL` / `MEDIA_ROOT`.
  - `redlin_web/redlin_web/urls.py` — `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)` en DEBUG.

Detalles técnicos y puntos importantes
- pdfjs / worker version
  - Es crítico que la versión de `pdfjs-dist` coincida con la versión interna que `react-pdf` espera. En esta implementación se fijó `pdfjs-dist` a la versión `4.8.69` para evitar errores "Worker version mismatch".
  - Import recomendado del worker para Vite: `import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` y luego `pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;`.
  - Evitar usar el worker vía CDN en producción sin configurar CORS correctamente.

- Highlights
  - Implementados como overlays en el frontend: selección de texto -> se normaliza rects (coordenadas relativas) y se dibuja un overlay verde translúcido.
  - Actualmente no se persisten en backend; son locales y desaparecen al recargar. Se propuso un modelo para persistencia (ver más abajo).

- Entorno y variables
  - Frontend: `VITE_API_URL` — base URL de la API (ej: `http://127.0.0.1:8000/api`). Debe estar en `.env` de Vite para que `import.meta.env.VITE_API_URL` la lea.
  - Backend: variables estándar de Django (SECRET_KEY, DEBUG, DB settings) permanecen en el proyecto.

Cómo ejecutar (dev)
- Backend (sin Docker):
  1. Crear virtualenv e instalar dependencias:

     ```bash
     python -m venv .venv
     source .venv/bin/activate
     pip install -r redlin_web/requirements.txt
     ```

  2. Configurar `.env` / settings local según tu flujo.
  3. Migraciones:

     ```bash
     python redlin_web/manage.py migrate
     ```

  4. Ejecutar servidor:

     ```bash
     python redlin_web/manage.py runserver
     ```

- Frontend (sin Docker):
  1. Entrar a la carpeta del frontend y instalar paquetes:

     ```bash
     cd redlin-front/redlin-front
     npm install
     # si necesitas forzar la versión de pdfjs-dist:
     npm install pdfjs-dist@4.8.69
     ```

  2. Crear `.env` (local):

     ```env
     VITE_API_URL=http://127.0.0.1:8000/api
     ```

  3. Ejecutar Vite dev server:

     ```bash
     npm run dev
     ```

- Docker
  - Si usas docker-compose (archivo `docker-compose.yml` en repo), monta volúmenes de código y ejecuta `docker compose up --build`. Asegúrate de instalar dependencias `npm install` dentro del contenedor frontend o en tu CI Dockerfile según config.

Verificación rápida (smoke test)
- Abrir la app en el navegador.
- Seleccionar un documento desde el sidebar.
- En el centro debe aparecer el PDF (barra de zoom en toolbar, selección de texto debe permitir copiar).
- En la derecha: pestañas centradas (Flashcards / Review / Quiz / Summary), tarjeta central con progress y lista de Card Overview debajo.
- Seleccionar texto y activar el modo highlight: el resaltado aparece sobre el PDF (nota: local-only por ahora).
- Endpoint backend: prueba manual con curl (con token) para confirmar streaming:

  ```bash
  curl -H "Authorization: Bearer <TOKEN>" "${API_URL}/documents/<id>/file/" --output sample.pdf
  ```

Problemas comunes y soluciones ya resueltas
- Worker CORS / blank viewer
  - Solución: importar worker local `.mjs?url` y fijar `pdfjs-dist` a una versión compatible.
- Worker version mismatch
  - Solución: fijar `pdfjs-dist@4.8.69` para compatibilidad con la versión de react-pdf usada.
- Archivo PDF no encontrado en MEDIA (500)
  - Solución: backend fallback a `redlin_web/documents/` para cubrir archivos seed que vienen con el repo.
- Pequeño hueco superior en layout
  - Solución: quitar padding top en `src/layouts/AppLayout.jsx` (pt: 0, mt: 0) y garantizar `html, body, #root` usan height: 100% si es necesario.

Propuesta de mejoras/PRÓXIMOS PASOS
1. Persistir highlights en backend (MVP):
   - Modelo Django `Highlight` con campos: document (FK), user (FK), page_number (int), rects (JSON), color, excerpt (text), created_at.
   - Endpoints: list/create/delete para highlights (`/api/documents/{id}/highlights/`).
   - Frontend: guardar highlights tras la selección y cargar highlights al abrir documento (merge con overlay existente).

2. Tests:
   - Unit tests para acción `file()` en `DocumentViewSet` (casos: propietario autorizado, no autorizado, fallback filesystem).
   - Frontend: tests de integración para: render de `PdfViewer`, zoom y overlay de highlights.

3. UX:
   - Sticky tabs en panel derecho (si quieres que la barra de pestañas quede fija al hacer scroll).
   - Persistencia del estado del zoom por documento.

Mapa de requisitos -> estado
- Visor central (zoom, selection, highlight local): Done
- Panel derecho con Flashcards/Review/Quiz/Summary (centrado, 700px): Done
- Endpoint seguro para streaming PDF con fallback: Done
- Persistencia server-side de highlights: Pending (propuesta incluida)

Notas de mantenimiento
- Mantén la versión de `pdfjs-dist` fijada mientras react-pdf no se actualice.
- Evita usar CDN worker sin configurar CORS correctamente.

Contacto rápido
- Archivos clave para editar si necesitas cambiar comportamiento del viewer: `src/components/PdfViewer/*`.
- Backend streaming: `redlin_web/API/views.py`.

---
Archivo generado automáticamente: `docs/IMPLEMENTATION_PDF.md`.

