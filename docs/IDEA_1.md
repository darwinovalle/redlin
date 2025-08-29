Brutal la visión. Te propongo un diseño integral que une modos (MCQ, Cloze, Feynman), espacios (Spaces), repetición espaciada, streak/XP y el planificador tipo kanban. La idea es no romper lo que ya tienes y sumar piezas bien acopladas.

Resumen de enfoque
- Unificar progreso por usuario-ítem (genérico) para cualquier tipo: MCQ, Flashcard, Cloze, Feynman.
- Selección “Quick” y “Overall” que equilibra urgencia (due), olvido, dificultad y cobertura de temas.
- Evaluación de respuestas abiertas (Cloze/Feynman) con LLM + rúbrica + similitud semántica.
- Spaces para agrupar PDFs, videos, etc. y un Planificador (kanban) auto-generado por IA con tareas new/inprogress/done y reportes.
- Sistema de XP/Streak con reglas claras y anti-abuso.

Arquitectura (a alto nivel)
- Django + DRF para API.
- Celery/Redis para tareas pesadas: generación de items, evaluación LLM, autoplan, reportes.
- Motor SR/selección: utils dedicados (spaced_repetition.py, selection.py).
- Servicio de evaluación: un módulo que llama al LLM (con prompts y verificación) y retorna scoring + feedback.
- Almacenamiento: tus tablas actuales + nuevas tablas de progreso/sesión/space/plan.

Modelo de datos (añadidos sin romper lo existente)
Mantén tus tablas actuales (API_*, VIDEO_*). Agrega modelos genéricos para: progreso por usuario, intentos, sesiones, spaces, plan y XP.

Nuevos modelos clave (Django, versión resumida)

```python
# apps/core/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

User = get_user_model()

class Space(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="spaces")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    visibility = models.CharField(max_length=20, choices=[("private","Private"),("unlisted","Unlisted")], default="private")
    created_at = models.DateTimeField(auto_now_add=True)

class SpaceItem(models.Model):
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="items")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    topic = models.CharField(max_length=200, blank=True)  # opcional
    importance = models.FloatField(default=1.0)
    added_at = models.DateTimeField(auto_now_add=True)

class LearningProgress(models.Model):
    # Progreso SR por usuario y por ítem (MCQ, Flashcard, Cloze, Feynman)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="learning_progress")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    status = models.CharField(max_length=20, choices=[
        ("new","New"), ("learning","Learning"), ("mastered","Mastered")
    ], default="new")
    # SM-2/FSRS-like
    last_reviewed = models.DateTimeField(null=True, blank=True)
    next_review_at = models.DateTimeField(null=True, blank=True)
    times_shown = models.PositiveIntegerField(default=0)
    score = models.FloatField(default=0.0)         # 0..1
    repetitions = models.PositiveIntegerField(default=0)
    interval = models.PositiveIntegerField(default=0)  # days
    easiness = models.FloatField(default=2.5)      # E-Factor
    consecutive_passes = models.PositiveIntegerField(default=0)
    last_quality = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user","content_type","object_id"], name="uniq_progress_per_user_item")
        ]
        indexes = [
            models.Index(fields=["user","next_review_at"]),
            models.Index(fields=["user","status"]),
        ]

class StudySession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    space = models.ForeignKey(Space, null=True, blank=True, on_delete=models.SET_NULL)
    mode = models.CharField(max_length=20, choices=[("quick","Quick"), ("overall","Overall")])
    method = models.CharField(max_length=20, choices=[("MCQ","MCQ"),("CLOZE","Cloze"),("FEYNMAN","Feynman"),("MIXED","Mixed")])
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    items_count = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    percent = models.FloatField(default=0.0)
    passed = models.BooleanField(default=False)

class Attempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attempts")
    session = models.ForeignKey(StudySession, null=True, blank=True, on_delete=models.SET_NULL, related_name="attempts")
    method = models.CharField(max_length=20, choices=[("MCQ","MCQ"),("CLOZE","Cloze"),("FEYNMAN","Feynman")])

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)

    # Resultado
    correct = models.BooleanField(default=False)
    confidence = models.IntegerField(null=True, blank=True)  # 0..3 opcional
    raw_answer = models.TextField(blank=True)                # texto del usuario (Cloze/Feynman)
    ai_score = models.FloatField(null=True, blank=True)      # 0..1 para abiertos
    ai_feedback = models.JSONField(null=True, blank=True)    # explicación, puntos, citas
    quality = models.IntegerField(default=0)                 # q ∈ [0..5] para SR

class XPAccount(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="xp_account")
    xp_total = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

class XPAward(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="xp_awards")
    session = models.ForeignKey(StudySession, null=True, blank=True, on_delete=models.SET_NULL)
    amount = models.IntegerField()
    reason = models.CharField(max_length=100)  # "quick_pass", "overall_pass", etc.
    created_at = models.DateTimeField(auto_now_add=True)

class StudyPlan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    space = models.ForeignKey(Space, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    version = models.IntegerField(default=1)
    period_start = models.DateField()
    period_end = models.DateField()
    created_by_ai = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PlanTask(models.Model):
    plan = models.ForeignKey(StudyPlan, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[("new","New"),("inprogress","In Progress"),("done","Done")], default="new")
    due_date = models.DateField(null=True, blank=True)
    expected_minutes = models.IntegerField(default=30)
    priority = models.IntegerField(default=0)
    topic = models.CharField(max_length=200, blank=True)

class PlanTaskItem(models.Model):
    task = models.ForeignKey(PlanTask, on_delete=models.CASCADE, related_name="items")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

class PlanReport(models.Model):
    plan = models.ForeignKey(StudyPlan, on_delete=models.CASCADE)
    period_start = models.DateField()
    period_end = models.DateField()
    summary = models.JSONField(default=dict)  # métricas, gráficos
    created_at = models.DateTimeField(auto_now_add=True)
```

Por qué así:
- GenericForeignKey te permite referenciar cualquier ítem actual (API_mcq, VIDEO_videomcq, API_flashcard, etc.) sin migrar todo.
- LearningProgress centraliza SR, score y dominio “consecutive_passes”, usable en todos los métodos (MCQ/Cloze/Feynman).
- Session/Attempt capturan métricas, feedback y sirven para XP/streak.
- Space/SpaceItem construyen cursos personalizados a partir de PDFs y videos.
- StudyPlan/PlanTask implementan el kanban auto-generado por IA (new/inprogress/done) y los reportes.

Algoritmos y reglas (clave)

1) Repetición espaciada (SR) unificada
- Puedes mantener SM-2 (ya lo tienes) y aplicarlo vía LearningProgress.
- Mapea calidad q ∈ [0..5] según método:
  - MCQ: usa correcto/tiempo/confianza → q (como te propuse antes).
  - Cloze: ai_score ∈ [0..1]; mapea a q por umbrales: [≥0.9→5, ≥0.8→4, ≥0.65→3, ≥0.5→2, ≥0.3→1, <0.3→0].
  - Feynman: calcula ai_score con rúbrica (exactitud, cobertura, claridad, vocabulario). Promedia ponderado y mapea a q con los mismos umbrales.
- Actualiza LearningProgress con SM-2:
  - q<3 → repetitions=0, interval=1d
  - q≥3 → repetitions++, interval: 1, 6, luego round(prev*E); E = clamp(E + f(q), [1.3, 2.8])
  - next_review_at = now + interval días
  - score: EMA de q mapeado a p∈[0..1]; afecta status.
- Mastery:
  - A nivel ítem: status=mastered si score≥0.85 y repetitions≥5, o si consecutive_passes≥3 en pruebas “overall” para ese ítem.
  - A nivel tema/space: considera “mastered” cuando el usuario apruebe 3 sesiones overall consecutivas ≥80% para ese tema/space. Guarda los contadores por Space/Topic si quieres granularidad.

2) Selección de ítems (Quick y Overall)
- Señales:
  - due/overdue (next_review_at)
  - predicción de recuerdo p_recall (opcional con Beta-Bernoulli o Elo)
  - dificultad/“leech” (muchos fallos recientes)
  - cobertura por tema
  - novedad controlada
- Prioridad S (ejemplo):
  - S = 1.2*overdue_ratio + 1.0*(1 - p_recall) + 0.5*leech + 0.6*importance - 0.3*recency + 0.3*is_new
- Quick (20):
  - Candidatos = due ∪ near_due(24h) ∪ low p_recall ∪ algunos nuevos
  - Ordena por S; aplica cobertura por topic (p.ej. máx 4/tema) y muestreo ponderado.
- Overall:
  - Mezcla de métodos (MCQ/Cloze/Feynman) según distribución, cubriendo todos los topics del Space o Document.
  - No necesariamente actualiza SR si es “modo examen”, pero sí cuenta para consecutive_passes y mastery a nivel Space/Topic.

3) Evaluación de Cloze y Feynman con IA
- Pipeline:
  1) Recupera contexto (párrafo origen/citas) del que se generó el ítem.
  2) Evalúa con LLM usando una rúbrica explícita y pide: score 0..1, juicio binario, feedback y citas (“evidence span”).
  3) Calcula ai_score y quality q por umbral.
- Rúbrica sugerida:
  - Exactitud factual (0–0.5)
  - Cobertura de puntos clave (0–0.3)
  - Claridad y estructura (0–0.1)
  - Terminología adecuada (0–0.1)
  - Penalizaciones: invenciones, contradicciones, falta de foco.
- Anti-falsos positivos:
  - Requiere citar frases del texto (o timestamp del video) que justifiquen el feedback.
  - Similaridad semántica embedding(user_answer, reference) ≥ τ como check adicional.
  - Si LLM y embedding discrepan mucho, marcar para revisión o dar score conservador.

Prompt (resumen) para Feynman
- Sistema: “Eres un evaluador riguroso…”
- Instrucciones: Devuelve JSON con fields: correct(bool), score(0..1), feedback, evidence_spans[], rubric_breakdown.
- Contexto: fragmento original; respuesta del usuario; puntos esenciales esperados.

4) Reglas de XP y Streak
- Streak del día:
  - El usuario marca streak completado al pasar una sesión (quick u overall) con ≥80% y ≥N ítems (p.ej., N≥10 en quick; N≥15 en overall).
- XP:
  - Base: 100 XP por sesión “passed” (quick/overall de cualquier método).
  - Bonos:
    - +10% por completar due backlog > X.
    - +10% por “leeches” rehabilitados.
  - Anti-abuso:
    - No otorgar XP si latency_ms medio < 1.5s por pregunta (sospechoso).
    - Cap diario suave (p.ej. 600 XP) con rendimientos decrecientes.
- Nivel:
  - level = floor((xp_total/1000)^(0.6) * 10) o cualquier curva que prefieras.

5) Spaces y curso personalizado
- Space agrupa Document, Video, etc. con SpaceItem.
- Tags/Topics: puedes usar el campo topic de SpaceItem o un sistema de tags para cobertura y reports.
- Due items por Space: filtra LearningProgress por items presentes en el Space.

6) Planificador Kanban (autogenerado)
- Entradas: Space, disponibilidad semanal del usuario (p.ej. 5h/sem), fecha inicio/fin.
- Pasos:
  1) Extrae topics y estima dificultad (longitud, densidad de conceptos).
  2) Secuencia: introductorio → intermedio → avanzado (orden topológico por prerequisitos inferidos).
  3) Crea PlanTasks con expected_minutes, due_date distribuidos por semanas/mes.
  4) Asigna PlanTaskItem a ítems concretos (lectura del fragmento, quick quiz MCQ, cloze session, feynman task).
  5) Set status=new; el usuario pasa a inprogress/done; autogenera reportes al cerrar periodo.
- Reporte mensual:
  - % tareas completadas, tiempo real invertido vs plan, retención (score SR), ítems leech, recomendaciones de refuerzo.

Endpoints (DRF, esquema mínimo)
- Spaces:
  - GET /spaces/, POST /spaces/
  - POST /spaces/{id}/items/  {content_type, object_id, topic?, importance?}
- Review:
  - GET /review/next?space_id=&method=&mode=&limit=20
  - POST /review/submit {session_id,item:{type,id}, method, answer, confidence?, latency_ms?, ai_payload?}
  - POST /review/session/start {space_id?, mode, method}
  - POST /review/session/finish {session_id}
- Progress/Mastery:
  - GET /progress/space/{id}
  - POST /progress/recompute-masteries (opcional admin)
- XP/Streak:
  - GET /xp/me
- Plan:
  - POST /plan/auto {space_id, period_start, period_end, hours_per_week}
  - GET /plan/{id}
  - PATCH /plan/tasks/{task_id} {status}
  - GET /plan/{id}/report

Selección (pseudocódigo)
```python
def get_candidates(user, space=None, method=None):
    qs = LearningProgress.objects.filter(user=user)
    if space:
        item_ids = SpaceItem.objects.filter(space=space).values_list("content_type_id","object_id")
        # filtra por esos pares (mejor con un join/cte)
    if method:
        # filtra por content_type de ese método
        ...
    return qs.select_related(...)

def priority(lp, now):
    overdue = 0.0
    if lp.next_review_at:
        overdue = max(0.0, (now - lp.next_review_at).total_seconds()/86400) / (lp.interval + 1e-6)
    p_recall = predict_recall(lp)  # Beta/Elo o aprox por score
    leech = 1.0 if lp.repetitions > 4 and lp.score < 0.5 else 0.0
    recency = 1.0 if lp.last_reviewed and (now - lp.last_reviewed).total_seconds() < 3600 else 0.0
    return 1.2*overdue + 1.0*(1 - p_recall) + 0.5*leech - 0.3*recency

def select_quick(user, space, method, limit=20):
    now = timezone.now()
    cands = get_candidates(user, space, method)
    scored = sorted(cands, key=lambda lp: priority(lp, now), reverse=True)
    return diversify_by_topic(scored, limit)
```

Mastery “3 consecutivas”
- A nivel ítem: incrementa consecutive_passes cuando la sesión overall en la que aparece el ítem fue “passed” y el intento del ítem fue correcto/ai_score≥0.8. Resetea a 0 si falla.
- A nivel Space/Topic: guarda contador por combinación en una tabla agregada o en un campo en StudySession si quieres simplicidad: si el usuario aprueba 3 sesiones overall consecutivas del mismo Space, marca “mastered” ese Space (o el Topic si segmentas).

Métricas y límites
- Calidad de items IA: incluye validadores (p. ej., todos los MCQ deben tener distractores plausibles, longitud/ambigüedad controlada).
- Versionado: si cambias una pregunta, versiona y desvincula intentos previos.
- Performance: índices en (user, next_review_at), (space, content_type, object_id), y prefetch en queries de sesiones.
- Privacidad: no envíes contenido completo a LLM; recorta al mínimo contexto.

Fases de implementación (roadmap)
1) Infra base:
   - LearningProgress + Attempt + StudySession + XPAccount (+ migraciones).
   - Funciones SR unificadas y endpoints /review/session, /review/submit.
   - Selección Quick para MCQ.
2) Streak/XP:
   - Regla ≥80% y 100 XP por sesión “passed”.
   - UI de racha.
3) Cloze + Feynman:
   - Modelos de ítem (si no existen) o generación on-demand.
   - Servicio de evaluación LLM con rúbrica y evidencia.
   - Integrar scoring→SR.
4) Spaces:
   - CRUD de Spaces y SpaceItem.
   - Filtro de selección por Space.
5) Overall test mixto:
   - Sampling por método + cobertura por topic.
   - Mastery 3 consecutivas (ítem + space).
6) Planificador (kanban):
   - Auto-plan mensual, tasks new/inprogress/done, reportes.
   - Ajuste por disponibilidad del usuario.
7) Optimización:
   - p_recall con Beta/Elo, “leech handling”, explicaciones generadas contextuales.
   - Modo examen (no SR) vs modo aprendizaje (sí SR).

Puntuaciones recomendadas
- ai_score (0..1) para abiertos; correctness booleana para MCQ.
- quality q para SR según umbrales (ver arriba).
- percent sesión = correct_count / items_count.
- XP: 100 por passed; bonuses pequeños por leeches rehabilitados; cap diario suave.
- Nivelación: curva sublineal para evitar grind.

Riesgos y mitigación
- Falsos positivos IA: usa evidencia + doble chequeo con embeddings, límites estrictos de score.
- Fatiga cognitiva: “quick” por método con 10–20 ítems máximo; interleaving suave en overall; recordatorios breves.
- Consistencia de datos: UniqueConstraint en LearningProgress; versiona items; audita intents.
- Escalabilidad: Celery para batch (evaluación, plan, reportes); caching de “due counts”.

Qué haría ya mismo (con lo que tienes)
- Agregar LearningProgress/Attempt/Session y reusar tus MCQs/Flashcards actuales vía GenericForeignKey.
- Implementar selección Quick para MCQ + SR unificado.
- Añadir XP/Streak con la regla 80%≥.
- Crear Space/SpaceItem y filtrar preguntas por Space.
- Luego sumar Cloze/Feynman con el evaluador LLM y el Overall mixto.
