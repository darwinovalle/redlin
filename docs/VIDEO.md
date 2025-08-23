# VIDEO API

## Resumen
Módulo para:
- Ingestar un video de YouTube vía URL.
- Obtener el transcript.
- Generar Summary enriquecido (con emojis y timestamps).
- Generar MCQs cubriendo conceptos clave.
- Consultar resultados y reprocesar.
- Autenticación vía JWT (reutiliza `API.jwt_auth`).

Base path: `/api/video/`

## Modelos

### Video
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | int | PK |
| user | FK(User) | Propietario |
| url | URL | URL original del video |
| video_id | str (nullable) | ID YouTube extraído |
| title | str (nullable) | Reservado (no generado aún) |
| processing_status | enum(pending,processing,completed,failed) | Estado |
| snippet_count | int | Cantidad de segmentos transcript |
| transcript_text | text | Transcript concatenado |
| created_at | datetime | Creación |

### VideoSummary
| Campo | Tipo | Descripción |
|-------|------|-------------|
| video | OneToOne(Video) | Relación |
| content | text | Resumen generado (markdown / texto enriquecido) |

### VideoMCQ
| Campo | Tipo | Descripción |
|-------|------|-------------|
| video | FK(Video) | Relación |
| question | text | Pregunta |
| correct_answer | str | Respuesta correcta |
| option_1 / 2 / 3 | str | Distractores |

## Estados de Procesamiento
- pending: recién creado
- processing: transcript / LLM en curso
- completed: summary + MCQs generados (aunque alguno pudo fallar parcialmente)
- failed: error definitivo (transcript o generación)

## Autenticación
Enviar encabezado:
```
Authorization: Bearer <ACCESS_TOKEN>
```
Todas las rutas requieren usuario autenticado.

## Endpoints

### 1. Crear Video
POST `/api/video/videos/`

Body:
```json
{
  "url": "https://www.youtube.com/watch?v=Z6nkEZyS9nA",
  "languages": ["en"]
}
```
`languages` (opcional) prioriza idiomas de transcript.

Respuesta (201):
```json
{
  "id": 12,
  "url": "https://www.youtube.com/watch?v=Z6nkEZyS9nA",
  "video_id": null,
  "title": null,
  "created_at": "2025-08-22T16:40:00Z",
  "processing_status": "processing",
  "snippet_count": 0,
  "transcript_text": ""
}
```

### 2. Listar Videos del Usuario
GET `/api/video/videos/`

### 3. Detalle Video
GET `/api/video/videos/{id}/`

### 4. Summary
GET `/api/video/videos/{id}/summary/`

404 si aún no generado.

### 5. MCQs
GET `/api/video/videos/{id}/mcqs/`

Lista:
```json
[
  {
    "id": 55,
    "video": 12,
    "question": "What concept ...?",
    "correct_answer": "Correct",
    "option_1": "Distractor A",
    "option_2": "Distractor B",
    "option_3": "Distractor C"
  }
]
```

### 6. Full Details
GET `/api/video/videos/{id}/full_details/`

Combina video + summary + mcqs.

### 7. Reprocesar
POST `/api/video/videos/{id}/reprocess/`

Body opcional:
```json
{ "languages": ["es"] }
```
Resetea a pending y reprocesa.

### Códigos de Respuesta
- 200 OK
- 201 Created
- 400 Bad Request (datos inválidos / ya procesando)
- 401 Unauthorized (sin token / token inválido)
- 404 Not Found (video inexistente / summary ausente)
- 500 Error interno (fallo inesperado)

## Lógica de Procesamiento

1. Extraer `video_id` (patrones YouTube).
2. Obtener transcript (API youtube-transcript-api v1.2.2 usando `fetch()`).
3. Concatenar snippets → `transcript_text`.
4. Detección ligera de idioma:
   - Mayoría inglés ⇒ output en inglés
   - Mayoría español ⇒ output en español
   - Otro idioma ⇒ forzar inglés
5. Construir referencia de timestamps `[mm:ss] fragmento`.
6. Generar Summary:
   - Títulos con emojis.
   - Secciones temáticas.
   - Timestamps incrustados en afirmaciones.
   - Secciones: Key Takeaways + Timeline Highlights.
7. Determinar número objetivo MCQs:
   - ≈ 1 por 120 palabras (mín 5, máx 25).
8. Generar MCQs:
   - Formato estricto (Q/A/B/C/D).
   - Cobertura conceptual (sin relleno).
   - Distractores plausibles.
9. Guardar (reemplazando MCQs previos).
10. Actualizar estado.

## Heurísticas
- Lenguaje: listas de stopwords (simple, rápido).
- MCQ count escalado por tamaño del transcript.

## Prompts (Resumen)
- Summary: estructura, emojis, timestamps, secciones.
- MCQs: EXACT count, formato, cobertura total, sin repeticiones.

## Reintentos LLM
- Backoff exponencial básico al detectar rate/quota (mensaje 429).
- Hasta 3 intentos.

## Admin
Secciones:
- Videos (inline Summary + MCQs)
- VideoSummary
- VideoMCQ

Campos readonly: `video_id`, `snippet_count`, `transcript_text`.

## Errores Comunes
| Situación | Acción |
|-----------|--------|
| Sin transcript | Estado failed |
| Rate limit LLM | Reintentos; si excede ⇒ summary/mcqs ausentes (pero video puede marcarse completed si transcript ok) |
| Formato MCQs inválido | Se descartan bloques no conformes |

## Ejemplo Flujo Curl

Crear:
```bash
curl -X POST http://localhost:8000/api/video/videos/ \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"url":"https://youtu.be/Z6nkEZyS9nA"}'
```

Ver progreso:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/video/videos/
```

Full details:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/video/videos/12/full_details/
```

Reprocesar:
```bash
curl -X POST http://localhost:8000/api/video/videos/12/reprocess/ \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"languages":["en"]}'
```

## Dependencias Clave
- `youtube-transcript-api==1.2.2`
- `google-generativeai`
- `djangorestframework`
- `drf-spectacular`
- `python-dotenv`

Variable requerida:
```
GOOGLE_API_KEY=...
```

## Posibles Mejoras Futuras
- Persistir título real del video (YouTube Data API).
- Procesamiento asíncrono (Celery + cola).
- Cache transcripts.
- Evaluación automática calidad de MCQs.
- Paginación MCQs.
- Traducción opcional.

## Notas de Seguridad
- Validar que el URL apunta a dominio YouTube.
- Limitar longitud de transcript procesado (tokens).
- Revisar cuotas de LLM.

Fin.