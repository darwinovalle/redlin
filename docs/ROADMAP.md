¡Vamos con todo! Te dejo un roadmap/to-do bien accionable para llevar tu visión a producción, con pasos por fases, entregables, endpoints y criterios de aceptación. Puedes copiarlo a tu gestor de tareas o a issues de GitHub.

Roadmap por fases (con checklists)

Fase 0 — Preflight y base del repo
- [ ] Crear app/core para modelos genéricos (LearningProgress, Attempt, StudySession, XP, Spaces, Plan).
- [ ] Configurar DRF, Celery + Redis (tareas: evaluación LLM, autoplan, reportes).
- [ ] Habilitar ContentTypes para referenciar ítems de distintos módulos (API_mcq, VIDEO_videomcq, API_flashcard, etc.).
- [ ] Definir feature flags (ej. USE_FSRS, ENABLE_MIXED_OVERALL, ENABLE_XP_BONUS_LEECH).
- [ ] Instrumentación: Sentry/Logging, health checks, variables de entorno (LLM_API_KEY, TIMEZONE).
- [ ] Decidir time zone del streak y SR (ej. tz del usuario o UTC normalizado con preferencia del usuario).

Fase 1 — Núcleo SR unificado y selección Quick (MCQ primero)
Backend/DB
- [ ] Modelo LearningProgress (SR por usuario-ítem) con: status, last_reviewed, next_review_at, times_shown, score, repetitions, interval, easiness, consecutive_passes, last_quality. Índices en (user, next_review_at) y (user, status). UniqueConstraint (user, content_type, object_id).
- [ ] Modelos Session y Attempt (métricas, correct, latency, confidence, ai_score, quality, feedback).
- [ ] Migration de datos:
  - [ ] Backfill LearningProgress desde API_flashcard y VIDEO_videoflashcard conservando SR (interval, E, reps, score…).
  - [ ] Para MCQs (API_mcq, VIDEO_videomcq), crear LearningProgress al primer intento (lazy create).
Utils/Algoritmo
- [ ] Implementar spaced_repetition.py:
  - [ ] evaluate_quality(correct, latency_ms, confidence) -> q
  - [ ] apply_sm2_update(obj, q), update_score(obj, q), schedule_next_review(obj), update_status(obj), record_review(obj, …)
- [ ] selection.py:
  - [ ] get_due_items(user, space?, method?, limit)
  - [ ] priority(lp) con señales: overdue, (1 - p_recall aprox por score), leech, recency, new
  - [ ] select_quick(user, space, method="MCQ", limit=20) con cobertura por topic si existe
API/Views
- [ ] POST /review/session/start {space_id?, mode: "quick", method: "MCQ"}
- [ ] GET /review/next?session_id=&limit=20
- [ ] POST /review/submit {session_id, item:{type,id}, method, correct, latency_ms?, confidence?}
- [ ] POST /review/session/finish {session_id}
Tests/Docs
- [ ] Unit: SM-2 flow (acierto→1d, 6d, luego *E; fallo resetea), evaluate_quality.
- [ ] Integración: ciclo de 20 preguntas quick MCQ, due ordering, actualización de SR.
- [ ] Docs: README SR + endpoints.
Criterios de aceptación
- [ ] Se pueden iniciar sesiones quick MCQ por Space o global.
- [ ] Ítems due se ordenan por prioridad y se actualizan con record_review.
- [ ] LearningProgress queda como fuente de verdad SR.

Fase 2 — Streak y XP
Backend/DB
- [ ] XPAccount (xp_total, level, current_streak, longest_streak, last_active_date).
- [ ] XPAward (traza de premios por sesión).
Lógica
- [ ] Regla de “passed”: sesión con ≥80% y mínimo de N preguntas (p.ej. quick N≥10, overall N≥15).
- [ ] +100 XP por sesión passed; cap diario suave (p.ej. 600); detección anti-abuso (latency media < 1.5s → no XP).
- [ ] Streak diario: si pasó al menos una sesión passed en el día del usuario → current_streak++ (manejar cortes de día).
API/Views
- [ ] GET /xp/me
- [ ] Hook en /review/session/finish para otorgar XP y streak.
Tests/Docs
- [ ] Tests: pasar/no pasar, cap diario, latencia sospechosa.
- [ ] Docs: reglas de XP/Streak y niveles.
Criterios de aceptación
- [ ] El usuario ve XP, nivel, streak; se actualiza al terminar sesiones.

Fase 3 — Modos Cloze y Feynman (evaluación con IA)
Backend/DB
- [ ] Modelos de ítem si no existen: ClozeItem, FeynmanPrompt (o generarlos on-demand y persistirlos para tracking).
- [ ] Guardar referencia al contexto fuente (fragmento del texto o timestamps del video) en el ítem.
Servicio de evaluación
- [ ] evaluador_llm.py:
  - [ ] evaluate_cloze(user_answer, reference) -> {score:0..1, correct:bool, feedback, evidence_spans}
  - [ ] evaluate_feynman(user_answer, rubric, context) -> idem
  - [ ] Umbrales a q: ≥0.9→5, ≥0.8→4, ≥0.65→3, ≥0.5→2, ≥0.3→1, <0.3→0
  - [ ] Check de similitud embeddings para anti-falsos positivos
- [ ] Celery task para evaluación asíncrona si la latencia del LLM es alta.
Integración
- [ ] POST /review/submit acepta raw_answer; llama al evaluador; rellena Attempt.ai_score/feedback/quality; actualiza SR.
Tests/Docs
- [ ] Tests con mocks del LLM y de embeddings → escenarios correcto/incorrecto/ambiguo.
- [ ] Docs: rúbrica, prompt, ejemplos.
Criterios de aceptación
- [ ] Quick Cloze y Quick Feynman funcionan end-to-end, con feedback y actualización SR.

Fase 4 — Spaces (agrupador de PDFs, videos, etc.)
Backend/DB
- [ ] Space y SpaceItem (GenericFK al contenido).
- [ ] Campo topic/importance opcional en SpaceItem; o tabla de Tags si quieres granularidad.
- [ ] Signal/Job: extracción de topics con IA al agregar items (opcional).
API
- [ ] CRUD: /spaces, /spaces/{id}/items
- [ ] Filtrado de /review/next por space_id
Tests/Docs
- [ ] Tests: añadir PDF/Video al mismo Space; selección quick filtrada.
Criterios de aceptación
- [ ] El usuario agrupa contenidos heterogéneos bajo un mismo Space y puede estudiar por Space.

Fase 5 — Overall mixto + “3 consecutivas” para mastery
Lógica
- [ ] Modo MIXED: sampler que mezcla MCQ/Cloze/Feynman con ratios configurables (ej. 60/20/20).
- [ ] Consecutive passes:
  - [ ] Por ítem: incrementa si en una sesión overall el ítem fue correcto (o score≥0.8). Resetea en fallo.
  - [ ] Mastery ítem: si consecutive_passes≥3 → status=mastered.
  - [ ] Opcional: mastery por Space/Topic (contador agregado).
API/Views
- [ ] /review/session/start {mode:"overall", method:"MIXED"|específico}
- [ ] Subir resultados como siempre; compute passed y actualizar consecutive_passes.
Tests/Docs
- [ ] Tests: conteo de consecutivas, mezcla de métodos, mastery flip.
Criterios de aceptación
- [ ] Overall mixto corre, y mastery 3x consecutivas funciona.

Fase 6 — Planificador Kanban (autogenerado por IA) + Reportes
Backend/DB
- [ ] StudyPlan, PlanTask, PlanTaskItem, PlanReport.
Servicio de planificación
- [ ] autoplan.py:
  - [ ] generate_plan(space, period_start, period_end, hours_per_week) → tasks con due_date, expected_minutes, topics
  - [ ] Asignar ítems (lecturas, quick MCQ, cloze, feynman) a cada task.
- [ ] Cron/Task: al final de periodo, generar PlanReport con métricas: %completado, tiempo estimado vs real, retención SR, ítems leech, recomendaciones.
API
- [ ] POST /plan/auto, GET /plan/{id}, PATCH /plan/tasks/{id} {status}, GET /plan/{id}/report
Tests/Docs
- [ ] Tests de creación de plan, actualización de estados, reporte.
Criterios de aceptación
- [ ] El usuario obtiene un itinerario mensual estilo kanban con estados new/inprogress/done y un reporte al cierre.

Fase 7 — Rendimiento, analítica y robustez
- [ ] Índices: (user, next_review_at), (space, content_type, object_id), (user, status).
- [ ] Prefetch/select_related en queries críticas.
- [ ] Cache de contadores “due”.
- [ ] Panel de métricas: retención semanal, % due completado, tiempo/respuesta.
- [ ] Rate limiting en endpoints de evaluación; colas Celery con prioridades.
- [ ] Alerta de costos de LLM.

Fase 8 — Modelos avanzados de dificultad y olvido (opcional)
- [ ] Beta-Bernoulli con decaimiento por ítem → p_recall.
- [ ] Elo usuario-ítem (θ vs b) para predicción de acierto.
- [ ] Integrar p_recall en priority() para selección.
- [ ] Evaluar FSRS y feature flag para migrar desde SM-2.

Detalles clave de implementación

- Mapeos de calidad q
  - MCQ: usa correcto + latencia + confianza (5/4/3 acierto; 2/1 fallo).
  - Cloze/Feynman: usa ai_score→q por umbral.
- Mastery
  - Ítem: score≥0.85 y repetitions≥5 O consecutive_passes≥3 en overall.
  - Space/Topic (opcional): 3 sesiones overall consecutivas ≥80%.
- Anti-abuso XP
  - No XP si latency media < 1.5s, o si se repiten exactas sin variar.
  - Cap diario con decaimiento: 100, 100, 100, 100, 100, 100 → luego 50% de premio.
- Cobertura de temas (quick/overall)
  - Diversify por topic: max_per_topic y mínimo 1 por topic cuando sea posible.
  - Si aún no modelas topic, usa SpaceItem.topic, o añade Tagging simple.

Prompts (resumen) para evaluación abierta

- Feynman evaluator (devuelve JSON):
  - Instrucciones: evalúa exactitud factual, cobertura, claridad, terminología. Puntúa 0..1. Devuelve correct(bool), score, feedback, evidence_spans (citas textuales o timestamps), rubric_breakdown. No inventes datos fuera del contexto.
- Cloze evaluator:
  - Compara respuesta con el blank esperado y el contexto. Permite equivalentes semánticos. Retorna la misma estructura JSON.

Endoints sugeridos (mínimos)
- POST /review/session/start
- GET /review/next
- POST /review/submit
- POST /review/session/finish
- GET /xp/me
- CRUD Spaces: /spaces, /spaces/{id}/items
- Plan: POST /plan/auto, GET /plan/{id}, PATCH /plan/tasks/{id}, GET /plan/{id}/report

Aceptación técnica por fase (resumen)
- F1: Quick MCQ opera con SR; due correcto; tests SM-2 pasan.
- F2: XP/Streak visibles y consistentes según reglas.
- F3: Cloze/Feynman evalúan con IA y actualizan SR; feedback útil.
- F4: Estudio por Space funcionando.
- F5: Overall mixto; mastery 3 consecutivas.
- F6: Plan kanban auto; reportes al cierre.
- F7: P95 de /review/next < 200ms con 50k ítems; costos LLM bajo control.
- F8: p_recall mejora selección (A/B contra baseline).

Sugerencia de tiempos
- Semana 1–2: Fase 1
- Semana 3: Fase 2
- Semana 4–5: Fase 3
- Semana 6: Fase 4
- Semana 7: Fase 5
- Semana 8–9: Fase 6
- Semana 10: Fase 7
- Semana 11+: Fase 8 (iterativo)

Siguientes pasos inmediatos
- [ ] Confirmar: ¿Prefieres arrancar con SM-2 (rápido) o FSRS (mejor modelado)? Recomiendo SM-2 ahora.
- [ ] ¿Necesitas modelos persistentes para Cloze/Feynman o los generas on-demand? Recomiendo persistirlos para SR.
- [ ] Definir umbrales de “passed” por modo y tamaños de sesión.
- [ ] Elegir qué campos usarás como topic (SpaceItem.topic vs Tagging).

Si quieres, te genero:
- Esqueletos de serializers y viewsets DRF para /review y /spaces
- Mando los prompts JSON ready para Feynman/Cloze
- Un management command para backfilling de LearningProgress desde tus flashcards actuales

¿Te lo paso como archivos (prompt.md, tasks.md, endpoints.md) para que lo metas directo al repo?
