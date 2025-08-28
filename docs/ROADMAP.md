## **ANÁLISIS DE VALIDACIÓN DEL MODELO DE DATOS**

Sí, tu modelo de datos **CUMPLE COMPLETAMENTE** con los 7 features requeridos. Aquí está la validación detallada:

### ✅ **Feature 1: Métodos Cloze y Feynman con AI**
- **Tablas**: `API_cloze`, `VIDEO_videocloze`, `API_feynman`, `VIDEO_videofeynman`
- **Evaluación AI**: `core_attempt` con campos `ai_score` y `ai_feedback`

### ✅ **Feature 2: Overall Test con Maestría (3x consecutivas)**
- **Sesiones**: `core_study_session` con `method=MIXED`
- **Progreso**: `core_learning_progress` con `consecutive_passes` y `status=mastered`

### ✅ **Feature 3: Sistema de Streaks y XP**
- **XP**: `core_xp_account`, `core_xp_award`
- **Validación 80%**: `core_study_session.percent` y `passed`

### ✅ **Feature 4: Modos Quick y Overall**
- **Implementado**: `session_mode` con valores `quick` y `overall`

### ✅ **Feature 5: Spaces (Organización de Contenido)**
- **Spaces**: `core_space`, `core_space_item` con GenericFK
- **Soporta**: PDFs y Videos en un mismo space

### ✅ **Feature 6: Suscripciones con Stripe**
- **Completo**: `subscription_plan`, `user_subscription`, `user_ai_credits`
- **Límites**: 3 docs free, 300 créditos premium

### ✅ **Feature 7: Learning Paths con Kanban**
- **Kanban**: `core_study_plan`, `core_plan_task` con estados
- **Reportes**: `core_plan_report`

---

## **ROADMAP DETALLADO DE IMPLEMENTACIÓN - 12 SEMANAS**

### **🎯 FASE 1: FUNDACIÓN (Semanas 1-2)**

#### **Semana 1: Setup y Migración de Base de Datos**

**Día 1-2: Preparación del Entorno**
```bash
# 1. Crear estructura de apps Django
python manage.py startapp core
python manage.py startapp subscriptions
python manage.py startapp analytics

# 2. Instalar dependencias
pip install stripe==5.5.0
pip install celery==5.3.0 redis==4.6.0
pip install openai==1.3.0 anthropic==0.7.0
pip install django-contenttypes
```

**Día 3-4: Crear Modelos Django**
```python
# core/models.py
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Space(models.Model):
    VISIBILITY_CHOICES = [
        ('private', 'Private'),
        ('unlisted', 'Unlisted'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

class SpaceItem(models.Model):
    space = models.ForeignKey(Space, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    topic = models.CharField(max_length=100, blank=True)
    importance = models.FloatField(default=1.0)
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['space', 'content_type', 'object_id']
```

**Día 5: Migraciones**
```python
# migrations/0001_initial.py
python manage.py makemigrations
python manage.py migrate

# migrations/0002_migrate_existing_data.py
def migrate_existing_content(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Space = apps.get_model('core', 'Space')
    
    for user in User.objects.all():
        # Crear space por defecto
        default_space = Space.objects.create(
            user=user,
            name="Mi Biblioteca",
            visibility='private'
        )
```

#### **Semana 2: APIs Base y Autenticación**

**Día 6-7: REST APIs Básicas**
```python
# core/serializers.py
from rest_framework import serializers

class SpaceSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Space
        fields = ['id', 'name', 'description', 'items_count']
    
    def get_items_count(self, obj):
        return obj.spaceitem_set.count()

# core/views.py
from rest_framework import viewsets

class SpaceViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceSerializer
    
    def get_queryset(self):
        return Space.objects.filter(user=self.request.user)
```

**Día 8-9: Tests Unitarios**
```python
# tests/test_spaces.py
class SpaceTestCase(TestCase):
    def test_create_space(self):
        user = User.objects.create_user('test')
        space = Space.objects.create(
            user=user,
            name="Test Space"
        )
        self.assertEqual(space.name, "Test Space")
```

**Día 10: Documentación**
- Documentar APIs con Swagger
- README actualizado

---

### **🚀 FASE 2: MÉTODOS DE APRENDIZAJE (Semanas 3-4)**

#### **Semana 3: Cloze y Feynman**

**Día 11-12: Generador de Cloze**
```python
# core/services/cloze_generator.py
import spacy
import random

class ClozeGenerator:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
    
    def generate_from_text(self, text, num_blanks=5):
        doc = self.nlp(text)
        
        # Identificar entidades importantes
        entities = [ent.text for ent in doc.ents]
        important_nouns = [token.text for token in doc 
                          if token.pos_ == "NOUN" and token.dep_ == "nsubj"]
        
        # Seleccionar palabras para ocultar
        candidates = list(set(entities + important_nouns))
        selected = random.sample(candidates, min(num_blanks, len(candidates)))
        
        cloze_items = []
        for word in selected:
            # Crear versión con blank
            text_with_blank = text.replace(word, "____", 1)
            cloze_items.append({
                'text_with_blank': text_with_blank,
                'answer': word,
                'context': text[:100]  # Contexto para hint
            })
        
        return cloze_items
```

**Día 13-14: Evaluador Feynman con AI**
```python
# core/services/feynman_evaluator.py
import openai

class FeynmanEvaluator:
    def evaluate_explanation(self, prompt, user_answer, key_points):
        messages = [
            {
                "role": "system",
                "content": """Evalúa esta explicación usando la técnica Feynman.
                Criterios:
                1. Simplicidad (¿puede entenderlo un niño de 12 años?)
                2. Precisión conceptual
                3. Completitud
                4. Uso de ejemplos
                
                Responde en JSON con:
                - score: 0-1
                - strengths: lista
                - weaknesses: lista
                - feedback: texto
                """
            },
            {
                "role": "user",
                "content": f"Prompt: {prompt}\nRespuesta: {user_answer}\nPuntos clave: {key_points}"
            }
        ]
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
            temperature=0.3
        )
        
        return json.loads(response.choices[0].message.content)
```

**Día 15: APIs de Cloze/Feynman**
```python
# core/views.py
class ClozeGenerateView(APIView):
    def post(self, request):
        text = request.data.get('text')
        generator = ClozeGenerator()
        cloze_items = generator.generate_from_text(text)
        
        # Guardar en BD
        for item in cloze_items:
            APICloze.objects.create(
                document_id=request.data.get('document_id'),
                **item
            )
        
        return Response({'items': cloze_items})

class FeynmanEvaluateView(APIView):
    def post(self, request):
        evaluator = FeynmanEvaluator()
        result = evaluator.evaluate_explanation(
            prompt=request.data.get('prompt'),
            user_answer=request.data.get('answer'),
            key_points=request.data.get('key_points', [])
        )
        
        # Guardar intento
        CoreAttempt.objects.create(
            user=request.user,
            method='FEYNMAN',
            ai_score=result['score'],
            ai_feedback=result
        )
        
        return Response(result)
```

#### **Semana 4: Sistema de Sesiones Unificado**

**Día 16-17: Gestor de Sesiones**
```python
# core/services/session_manager.py
class SessionManager:
    def create_session(self, user, space, mode, method):
        # Crear sesión
        session = CoreStudySession.objects.create(
            user=user,
            space=space,
            mode=mode,
            method=method,
            started_at=timezone.now()
        )
        
        # Seleccionar preguntas
        if mode == 'quick':
            questions = self.select_quick_questions(user, space, method, limit=20)
        else:  # overall
            questions = self.select_all_questions(user, space, method)
        
        session.items_count = len(questions)
        session.save()
        
        return session, questions
    
    def select_quick_questions(self, user, space, method, limit=20):
        """
        Distribución inteligente:
        - 35% para revisar (vencidas)
        - 25% áreas débiles
        - 25% contenido nuevo
        - 15% refuerzo aleatorio
        """
        questions = []
        
        # 1. Preguntas vencidas
        due_for_review = self.get_due_questions(user, space, method)
        questions.extend(due_for_review[:int(limit * 0.35)])
        
        # 2. Áreas débiles
        weak_areas = self.get_weak_questions(user, space, method)
        questions.extend(weak_areas[:int(limit * 0.25)])
        
        # 3. Nuevas
        new_questions = self.get_new_questions(user, space, method)
        questions.extend(new_questions[:int(limit * 0.25)])
        
        # 4. Refuerzo
        reinforcement = self.get_random_questions(user, space, method)
        remaining = limit - len(questions)
        questions.extend(reinforcement[:remaining])
        
        random.shuffle(questions)
        return questions[:limit]
```

**Día 18-19: Sistema de Maestría**
```python
# core/services/mastery_tracker.py
class MasteryTracker:
    def update_progress(self, user, question, is_correct):
        progress, created = CoreLearningProgress.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(question.__class__),
            object_id=question.id,
            defaults={'status': 'new'}
        )
        
        if is_correct:
            progress.consecutive_passes += 1
            progress.score = min(1.0, progress.score + 0.1)
            
            # Verificar maestría (3 consecutivas correctas)
            if progress.consecutive_passes >= 3:
                progress.status = 'mastered'
                self.award_mastery_bonus(user, question)
        else:
            progress.consecutive_passes = 0
            progress.score = max(0.0, progress.score - 0.2)
            progress.status = 'learning'
        
        # Actualizar repetición espaciada
        self.update_spaced_repetition(progress, is_correct)
        progress.save()
        
        return progress
    
    def update_spaced_repetition(self, progress, is_correct):
        """Algoritmo SM-2 modificado"""
        quality = 5 if is_correct else 2
        
        if quality >= 3:
            if progress.repetitions == 0:
                progress.interval = 1
            elif progress.repetitions == 1:
                progress.interval = 6
            else:
                progress.interval = round(progress.interval * progress.easiness)
            
            progress.repetitions += 1
        else:
            progress.repetitions = 0
            progress.interval = 1
        
        progress.easiness = max(1.3, progress.easiness + 0.1 * (quality - 3))
        progress.next_review_at = timezone.now() + timedelta(days=progress.interval)
```

**Día 20: Tests de Integración**
```python
# tests/test_sessions.py
class SessionTestCase(TestCase):
    def test_quick_session_creation(self):
        session, questions = SessionManager().create_session(
            user=self.user,
            space=self.space,
            mode='quick',
            method='MIXED'
        )
        self.assertLessEqual(len(questions), 20)
    
    def test_mastery_achievement(self):
        # Simular 3 respuestas correctas consecutivas
        for i in range(3):
            progress = MasteryTracker().update_progress(
                self.user, self.question, is_correct=True
            )
        self.assertEqual(progress.status, 'mastered')
```

---

### **💎 FASE 3: GAMIFICACIÓN (Semanas 5-6)**

#### **Semana 5: Sistema de XP y Niveles**

**Día 21-22: Calculador de XP**
```python
# core/services/xp_manager.py
class XPManager:
    BASE_XP = 100
    
    def calculate_session_xp(self, session):
        """Calcula XP basado en rendimiento"""
        if session.percent < 80:
            return 0  # No cumple el mínimo
        
        xp = self.BASE_XP
        
        # Bonificaciones
        if session.percent == 100:
            xp += 50  # Perfección
        
        if session.mode == 'overall':
            xp += 25  # Sesión completa
        
        # Bonus por velocidad
        avg_time_per_question = session.duration_seconds / session.items_count
        if avg_time_per_question < 30:
            xp += 25
        
        return xp
    
    def award_xp(self, user, amount, reason):
        xp_account, created = CoreXpAccount.objects.get_or_create(
            user=user,
            defaults={'xp_total': 0, 'level': 1}
        )
        
        xp_account.xp_total += amount
        
        # Calcular nuevo nivel
        xp_account.level = self.calculate_level(xp_account.xp_total)
        xp_account.save()
        
        # Registrar award
        CoreXpAward.objects.create(
            user=user,
            amount=amount,
            reason=reason
        )
        
        return xp_account
    
    def calculate_level(self, total_xp):
        """Cada nivel requiere 1000 XP más que el anterior"""
        level = 1
        xp_needed = 1000
        remaining = total_xp
        
        while remaining >= xp_needed:
            remaining -= xp_needed
            level += 1
            xp_needed += 1000
        
        return level
```

**Día 23-24: Sistema de Streaks**
```python
# core/services/streak_manager.py
from datetime import date, timedelta

class StreakManager:
    def update_streak(self, user):
        xp_account = CoreXpAccount.objects.get(user=user)
        today = date.today()
        
        if xp_account.last_active_date:
            days_diff = (today - xp_account.last_active_date).days
            
            if days_diff == 0:
                # Ya estudió hoy
                return xp_account
            elif days_diff == 1:
                # Continúa la racha
                xp_account.current_streak += 1
                xp_account.longest_streak = max(
                    xp_account.longest_streak,
                    xp_account.current_streak
                )
            else:
                # Racha rota
                xp_account.current_streak = 1
        else:
            # Primera vez
            xp_account.current_streak = 1
        
        xp_account.last_active_date = today
        xp_account.save()
        
        # Bonus por racha
        if xp_account.current_streak % 7 == 0:
            self.award_streak_bonus(user, xp_account.current_streak)
        
        return xp_account
    
    def award_streak_bonus(self, user, streak_days):
        bonus_xp = streak_days * 10
        XPManager().award_xp(user, bonus_xp, f'streak_{streak_days}_days')
```

**Día 25: Tareas Celery para Notificaciones**
```python
# core/tasks.py
from celery import shared_task

@shared_task
def check_streak_reminders():
    """Ejecutar diariamente a las 8 PM"""
    users_at_risk = CoreXpAccount.objects.filter(
        last_active_date=date.today() - timedelta(days=1),
        current_streak__gt=0
    )
    
    for xp_account in users_at_risk:
        send_streak_reminder(xp_account.user)

@shared_task
def reset_daily_challenges():
    """Resetear retos diarios a medianoche"""
    # Implementar retos diarios
    pass
```

#### **Semana 6: UI de Gamificación**

**Día 26-27: Dashboard de Progreso**
```javascript
// frontend/components/ProgressDashboard.jsx
import React from 'react';
import { CircularProgress, LinearProgress } from '@mui/material';

const ProgressDashboard = ({ userData }) => {
    const xpToNextLevel = calculateXPToNextLevel(userData.level, userData.xp_total);
    
    return (
        <div className="progress-dashboard">
            <div className="level-display">
                <CircularProgress 
                    variant="determinate" 
                    value={xpToNextLevel.percentage}
                />
                <h2>Nivel {userData.level}</h2>
                <p>{xpToNextLevel.current} / {xpToNextLevel.needed} XP</p>
            </div>
            
            <div className="streak-display">
                <FireIcon className={userData.current_streak > 0 ? 'active' : ''} />
                <h3>{userData.current_streak} días</h3>
                <p>Racha actual</p>
            </div>
            
            <div className="achievements">
                {userData.achievements.map(achievement => (
                    <AchievementBadge key={achievement.id} {...achievement} />
                ))}
            </div>
        </div>
    );
};
```

**Día 28-29: Animaciones y Feedback Visual**
```javascript
// frontend/components/XPAnimation.jsx
import { motion } from 'framer-motion';

const XPAnimation = ({ amount, onComplete }) => {
    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.5 }}
            onAnimationComplete={onComplete}
            className="xp-animation"
        >
            <span className="xp-amount">+{amount} XP</span>
        </motion.div>
    );
};
```

**Día 30: Leaderboard**
```python
# core/views.py
class LeaderboardView(APIView):
    def get(self, request):
        # Top 10 usuarios por XP
        top_users = CoreXpAccount.objects.select_related('user').order_by('-xp_total')[:10]
        
        # Posición del usuario actual
        user_rank = CoreXpAccount.objects.filter(
            xp_total__gt=request.user.xp_account.xp_total
        ).count() + 1
        
        return Response({
            'top_users': LeaderboardSerializer(top_users, many=True).data,
            'user_rank': user_rank
        })
```

---

### **💳 FASE 4: SISTEMA DE SUSCRIPCIONES (Semanas 7-8)**

#### **Semana 7: Integración con Stripe**

**Día 31-32: Configuración de Stripe**
```python
# subscriptions/stripe_setup.py
import stripe
from django.conf import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_stripe_products():
    """Ejecutar una vez para crear productos en Stripe"""
    
    # Producto Premium
    premium_product = stripe.Product.create(
        name="StudyAI Premium",
        description="Acceso ilimitado + 300 créditos AI mensuales + Analytics"
    )
    
    # Precio mensual
    monthly_price = stripe.Price.create(
        product=premium_product.id,
        unit_amount=999,  # $9.99
        currency='usd',
        recurring={'interval': 'month'}
    )
    
    # Precio anual
    yearly_price = stripe.Price.create(
        product=premium_product.id,
        unit_amount=9990,  # $99.90
        currency='usd',
        recurring={'interval': 'year'}
    )
    
    # Guardar en BD
    SubscriptionPlan.objects.create(
        tier='premium',
        name='Premium',
        max_documents=-1,  # Ilimitado
        ai_credits_monthly=300,
        has_analytics=True,
        price_monthly=999,
        price_yearly=9990,
        stripe_product_id=premium_product.id,
        stripe_price_monthly_id=monthly_price.id,
        stripe_price_yearly_id=yearly_price.id
    )
```

**Día 33-34: Webhooks de Stripe**
```python
# subscriptions/views.py
import stripe
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META['HTTP_STRIPE_SIGNATURE']
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return HttpResponse(status=400)
    
    # Guardar evento
    StripeWebhookEvent.objects.create(
        stripe_event_id=event['id'],
        type=event['type'],
        data=event
    )
    
    # Procesar según tipo
    if event['type'] == 'customer.subscription.created':
        handle_subscription_created(event)
    elif event['type'] == 'customer.subscription.updated':
        handle_subscription_updated(event)
    elif event['type'] == 'customer.subscription.deleted':
        handle_subscription_cancelled(event)
    elif event['type'] == 'invoice.payment_succeeded':
        handle_payment_succeeded(event)
    
    return HttpResponse(status=200)

def handle_subscription_created(event):
    subscription = event['data']['object']
    
    # Buscar usuario por customer_id
    user_sub = UserSubscription.objects.get(
        stripe_customer_id=subscription['customer']
    )
    
    # Actualizar estado
    user_sub.status = 'active'
    user_sub.stripe_subscription_id = subscription['id']
    user_sub.current_period_start = datetime.fromtimestamp(subscription['current_period_start'])
    user_sub.current_period_end = datetime.fromtimestamp(subscription['current_period_end'])
    user_sub.save()
    
    # Activar beneficios premium
    activate_premium_benefits(user_sub.user)
```

**Día 35: Middleware de Límites**
```python
# subscriptions/middleware.py
class SubscriptionLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if request.user.is_authenticated:
            # Verificar límites antes de procesar
            if request.path.startswith('/api/upload/'):
                self.check_document_limits(request)
            elif request.path.startswith('/api/ai/'):
                self.check_ai_credits(request)
        
        response = self.get_response(request)
        return response
    
    def check_document_limits(self, request):
        limits = UserUsageLimits.objects.get(user=request.user)
        
        if limits.documents_limit != -1:  # No es ilimitado
            if limits.documents_count >= limits.documents_limit:
                raise SubscriptionLimitExceeded(
                    "Has alcanzado el límite de documentos. Actualiza a Premium para continuar."
                )
    
    def check_ai_credits(self, request):
        credits = UserAICredits.objects.get(user=request.user)
        
        if credits.balance <= 0:
            raise InsufficientCreditsError(
                "No tienes créditos AI disponibles. Actualiza a Premium para obtener 300 créditos mensuales."
            )
```

#### **Semana 8: Sistema de Créditos AI**

**Día 36-37: Gestor de Créditos**
```python
# subscriptions/services/credits_manager.py
from django.db import transaction

class AICreditsManager:
    # Costos por operación
    COSTS = {
        'generate_mcq': 5,
        'generate_flashcard': 3,
        'generate_cloze': 4,
        'evaluate_feynman': 8,
        'generate_summary': 10,
        'generate_study_path': 15,
    }
    
    @transaction.atomic
    def consume_credits(self, user, operation, metadata=None):
        """Consume créditos para una operación"""
        credits = UserAICredits.objects.select_for_update().get(user=user)
        
        cost = self.COSTS.get(operation, 5)
        
        if credits.balance < cost:
            raise InsufficientCreditsError(
                f"Necesitas {cost} créditos para esta operación. Tu balance: {credits.balance}"
            )
        
        # Actualizar balance
        credits.balance -= cost
        credits.monthly_used += cost
        credits.lifetime_used += cost
        credits.save()
        
        # Registrar transacción
        CreditTransaction.objects.create(
            user=user,
            type='usage',
            amount=-cost,
            balance_after=credits.balance,
            description=f"Operación: {operation}",
            reference_type=operation,
            **metadata or {}
        )
        
        # Notificar si está bajo
        if credits.balance < 50:
            self.send_low_credits_notification(user, credits.balance)
        
        return credits.balance
    
    def reset_monthly_credits(self, user):
        """Resetear créditos mensuales para usuarios premium"""
        subscription = UserSubscription.objects.get(user=user)
        
        if subscription.plan.tier == 'premium':
            credits = UserAICredits.objects.get(user=user)
            credits.balance = subscription.plan.ai_credits_monthly
            credits.monthly_used = 0
            credits.monthly_reset_date = date.today()
            credits.save()
            
            # Registrar transacción
            CreditTransaction.objects.create(
                user=user,
                type='purchase',
                amount=subscription.plan.ai_credits_monthly,
                balance_after=credits.balance,
                description='Reset mensual de créditos'
            )
```

**Día 38-39: Tareas Programadas**
```python
# subscriptions/tasks.py
from celery import shared_task
from datetime import date

@shared_task
def reset_monthly_credits():
    """Ejecutar el día 1 de cada mes"""
    premium_users = UserSubscription.objects.filter(
        status='active',
        plan__tier='premium'
    ).select_related('user', 'plan')
    
    for subscription in premium_users:
        AICreditsManager().reset_monthly_credits(subscription.user)

@shared_task
def check_expiring_subscriptions():
    """Verificar suscripciones por vencer"""
    expiring_soon = UserSubscription.objects.filter(
        current_period_end__lte=timezone.now() + timedelta(days=3),
        status='active',
        auto_renew=False
    )
    
    for subscription in expiring_soon:
        send_expiration_reminder(subscription.user)
```

**Día 40: UI de Suscripción**
```javascript
// frontend/components/SubscriptionManager.jsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const CheckoutForm = ({ plan }) => {
    const stripe = useStripe();
    const elements = useElements();
    
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        // Crear intención de pago
        const { clientSecret } = await api.createSubscription(plan.id);
        
        // Confirmar pago
        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: elements.getElement(CardElement),
            }
        });
        
        if (result.error) {
            showError(result.error.message);
        } else {
            showSuccess('¡Suscripción activada!');
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <CardElement />
            <button type="submit" disabled={!stripe}>
                Suscribirse por ${plan.price_monthly / 100}/mes
            </button>
        </form>
    );
};
```

---

### **🤖 FASE 5: LEARNING PATHS CON AI (Semanas 9-10)**

#### **Semana 9: Generador de Paths con AI**

**Día 41-42: Analizador de Contenido**
```python
# core/services/path_generator.py
import openai
from typing import List, Dict

class PathGenerator:
    def analyze_space_content(self, space):
        """Analiza el contenido del space para crear un path"""
        content_items = SpaceItem.objects.filter(space=space)
        
        # Extraer información de cada item
        content_data = []
        for item in content_items:
            content_obj = item.content_object
            
            if hasattr(content_obj, 'document'):
                # Es un MCQ, Flashcard, Cloze, etc.
                doc = content_obj.document
                content_data.append({
                    'type': content_obj.__class__.__name__,
                    'title': doc.title,
                    'content': self.extract_text(doc),
                    'difficulty': self.estimate_difficulty(content_obj)
                })
        
        return content_data
    
    def generate_study_path(self, space, duration_days=30, daily_minutes=30):
        """Genera un path de estudio con AI"""
        content_data = self.analyze_space_content(space)
        
        prompt = f"""
        Crea un plan de estudio estructurado de {duration_days} días.
        
        Contenido disponible:
        {json.dumps(content_data, indent=2)}
        
        Tiempo diario: {daily_minutes} minutos
        
        Genera un JSON con la siguiente estructura:
        {{
            "title": "Título del plan",
            "description": "Descripción",
            "weeks": [
                {{
                    "week_number": 1,
                    "theme": "Tema de la semana",
                    "tasks": [
                        {{
                            "day": 1,
                            "title": "Título de la tarea",
                            "description": "Descripción",
                            "content_items": ["item_ids"],
                            "estimated_minutes": 30,
                            "priority": "high|medium|low"
                        }}
                    ]
                }}
            ]
        }}
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Eres un experto en diseño curricular y pedagogía."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return json.loads(response.choices[0].message.content)
    
    def create_kanban_tasks(self, space, path_data):
        """Crea tareas Kanban desde el path generado"""
        # Crear el plan
        study_plan = CoreStudyPlan.objects.create(
            user=space.user,
            space=space,
            title=path_data['title'],
            period_start=date.today(),
            period_end=date.today() + timedelta(days=30),
            created_by_ai=True
        )
        
        # Crear tareas
        for week in path_data['weeks']:
            for task_data in week['tasks']:
                task = CorePlanTask.objects.create(
                    plan=study_plan,
                    title=task_data['title'],
                    description=task_data['description'],
                    status='new',
                    due_date=date.today() + timedelta(days=task_data['day']),
                    expected_minutes=task_data['estimated_minutes'],
                    priority={'high': 1, 'medium': 2, 'low': 3}[task_data['priority']]
                )
                
                # Asignar items de contenido
                for item_id in task_data.get('content_items', []):
                    # Lógica para asignar items
                    pass
        
        return study_plan
```

**Día 43-44: API de Paths**
```python
# core/views.py
class StudyPathViewSet(viewsets.ModelViewSet):
    serializer_class = StudyPathSerializer
    
    @action(detail=False, methods=['post'])
    def generate_ai_path(self, request):
        """Genera un path de estudio con AI"""
        space_id = request.data.get('space_id')
        duration_days = request.data.get('duration_days', 30)
        daily_minutes = request.data.get('daily_minutes', 30)
        
        space = Space.objects.get(id=space_id, user=request.user)
        
        # Consumir créditos
        AICreditsManager().consume_credits(
            request.user,
            'generate_study_path',
            {'space_id': space_id}
        )
        
        # Generar path
        generator = PathGenerator()
        path_data = generator.generate_study_path(space, duration_days, daily_minutes)
        study_plan = generator.create_kanban_tasks(space, path_data)
        
        return Response(StudyPathSerializer(study_plan).data)
    
    @action(detail=True, methods=['patch'])
    def update_task_status(self, request, pk=None):
        """Actualiza el estado de una tarea"""
        task_id = request.data.get('task_id')
        new_status = request.data.get('status')
        
        task = CorePlanTask.objects.get(id=task_id, plan__user=request.user)
        task.status = new_status
        task.save()
        
        # Si completó todas las tareas, generar reporte
        if not task.plan.tasks.exclude(status='done').exists():
            self.generate_completion_report(task.plan)
        
        return Response({'status': 'updated'})
```

**Día 45: Kanban Board Frontend**
```javascript
// frontend/components/KanbanBoard.jsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const KanbanBoard = ({ plan }) => {
    const [tasks, setTasks] = useState(plan.tasks);
    
    const columns = {
        new: tasks.filter(t => t.status === 'new'),
        inprogress: tasks.filter(t => t.status === 'inprogress'),
        done: tasks.filter(t => t.status === 'done')
    };
    
    const onDragEnd = (result) => {
        if (!result.destination) return;
        
        const taskId = result.draggableId;
        const newStatus = result.destination.droppableId;
        
        // Actualizar en backend
        api.updateTaskStatus(plan.id, taskId, newStatus);
        
        // Actualizar estado local
        setTasks(prev => prev.map(task => 
            task.id === taskId ? {...task, status: newStatus} : task
        ));
    };
    
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="kanban-board">
                {Object.entries(columns).map(([status, columnTasks]) => (
                    <Droppable key={status} droppableId={status}>
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="kanban-column"
                            >
                                <h3>{status.toUpperCase()}</h3>
                                {columnTasks.map((task, index) => (
                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className="task-card"
                                            >
                                                <h4>{task.title}</h4>
                                                <p>{task.description}</p>
                                                <span className="time-estimate">
                                                    {task.expected_minutes} min
                                                </span>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    );
};
```

#### **Semana 10: Reportes y Analytics**

**Día 46-47: Generador de Reportes**
```python
# analytics/services/report_generator.py
class ReportGenerator:
    def generate_monthly_report(self, user, space, month):
        """Genera reporte mensual detallado"""
        
        # Recopilar datos
        sessions = CoreStudySession.objects.filter(
            user=user,
            space=space,
            started_at__month=month.month,
            started_at__year=month.year
        )
        
        # Calcular métricas
        metrics = {
            'total_sessions': sessions.count(),
            'total_time_minutes': sum(s.duration_seconds for s in sessions) / 60,
            'average_accuracy': sessions.aggregate(Avg('percent'))['percent__avg'],
            'items_mastered': CoreLearningProgress.objects.filter(
                user=user,
                status='mastered',
                last_reviewed__month=month.month
            ).count(),
            'xp_earned': CoreXpAward.objects.filter(
                user=user,
                created_at__month=month.month
            ).aggregate(Sum('amount'))['amount__sum'] or 0
        }
        
        # Análisis por método
        method_analysis = self.analyze_by_method(sessions)
        
        # Identificar fortalezas y debilidades
        insights = self.generate_insights(user, space, sessions)
        
        # Crear reporte
        report = CorePlanReport.objects.create(
            plan=space.active_plan,
            period_start=month.replace(day=1),
            period_end=(month + timedelta(days=31)).replace(day=1) - timedelta(days=1),
            summary={
                'metrics': metrics,
                'method_analysis': method_analysis,
                'insights': insights,
                'recommendations': self.generate_recommendations(insights)
            }
        )
        
        return report
    
    def generate_insights(self, user, space, sessions):
        """Genera insights basados en el rendimiento"""
        insights = {
            'strengths': [],
            'weaknesses': [],
            'trends': []
        }
        
        # Analizar por temas
        topic_performance = {}
        for session in sessions:
            attempts = CoreAttempt.objects.filter(session=session)
            for attempt in attempts:
                topic = self.get_topic_from_item(attempt.content_object)
                if topic not in topic_performance:
                    topic_performance[topic] = {'correct': 0, 'total': 0}
                
                topic_performance[topic]['total'] += 1
                if attempt.correct:
                    topic_performance[topic]['correct'] += 1
        
        # Identificar fortalezas y debilidades
        for topic, perf in topic_performance.items():
            accuracy = perf['correct'] / perf['total']
            if accuracy >= 0.8:
                insights['strengths'].append({
                    'topic': topic,
                    'accuracy': accuracy,
                    'message': f"Excelente dominio de {topic}"
                })
            elif accuracy < 0.6:
                insights['weaknesses'].append({
                    'topic': topic,
                    'accuracy': accuracy,
                    'message': f"Necesitas reforzar {topic}"
                })
        
        return insights
```

**Día 48-49: Dashboard de Analytics (Premium)**
```python
# analytics/views.py
class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsPremiumUser]
    
    def get(self, request):
        """Dashboard de analytics para usuarios premium"""
        user = request.user
        
        # Verificar acceso premium
        if not user.subscription.plan.has_analytics:
            return Response({'error': 'Analytics solo disponible para usuarios Premium'}, status=403)
        
        # Datos del último mes
        last_month = timezone.now() - timedelta(days=30)
        
        analytics_data = {
            'study_time_trend': self.get_study_time_trend(user, last_month),
            'accuracy_by_method': self.get_accuracy_by_method(user, last_month),
            'mastery_progress': self.get_mastery_progress(user),
            'learning_curve': self.get_learning_curve(user, last_month),
            'topic_distribution': self.get_topic_distribution(user),
            'predictions': self.get_retention_predictions(user)
        }
        
        # Registrar acceso
        UserAnalyticsAccess.objects.update_or_create(
            user=user,
            defaults={
                'has_access': True,
                'last_viewed_at': timezone.now(),
                'total_views': F('total_views') + 1
            }
        )
        
        return Response(analytics_data)
    
    def get_retention_predictions(self, user):
        """Predice retención usando curva de olvido"""
        items = CoreLearningProgress.objects.filter(
            user=user,
            status__in=['learning', 'mastered']
        )
        
        predictions = []
        for item in items[:20]:  # Top 20 items
            # Calcular probabilidad de retención
            days_since_review = (timezone.now() - item.last_reviewed).days
            retention_prob = self.calculate_retention_probability(
                item.easiness,
                item.interval,
                days_since_review
            )
            
            predictions.append({
                'item': str(item.content_object),
                'retention_probability': retention_prob,
                'recommended_review_date': item.next_review_at
            })
        
        return predictions
```

**Día 50: Visualizaciones Frontend**
```javascript
// frontend/components/AnalyticsDashboard.jsx
import { LineChart, BarChart, PieChart, RadarChart } from 'recharts';

const AnalyticsDashboard = () => {
    const [analytics, setAnalytics] = useState(null);
    
    useEffect(() => {
        api.getAnalytics().then(setAnalytics);
    }, []);
    
    if (!analytics) return <Loading />;
    
    return (
        <div className="analytics-dashboard">
            <div className="chart-grid">
                {/* Tendencia de tiempo de estudio */}
                <div className="chart-card">
                    <h3>Tiempo de Estudio</h3>
                    <LineChart data={analytics.study_time_trend}>
                        <Line type="monotone" dataKey="minutes" stroke="#8884d8" />
                        <CartesianGrid strokeDasharray="3 3" />
                        <Tooltip />
                    </LineChart>
                </div>
                
                {/* Precisión por método */}
                <div className="chart-card">
                    <h3>Precisión por Método</h3>
                    <BarChart data={analytics.accuracy_by_method}>
                        <Bar dataKey="accuracy" fill="#82ca9d" />
                        <XAxis dataKey="method" />
                        <YAxis />
                    </BarChart>
                </div>
                
                {/* Distribución de temas */}
                <div className="chart-card">
                    <h3>Distribución de Temas</h3>
                    <PieChart>
                        <Pie data={analytics.topic_distribution} dataKey="count" />
                    </PieChart>
                </div>
                
                {/* Curva de aprendizaje */}
                <div className="chart-card">
                    <h3>Curva de Aprendizaje</h3>
                    <LineChart data={analytics.learning_curve}>
                        <Line dataKey="mastery" stroke="#ff7300" />
                    </LineChart>
                </div>
            </div>
            
            {/* Predicciones de retención */}
            <div className="retention-predictions">
                <h3>Predicción de Retención</h3>
                {analytics.predictions.map(pred => (
                    <div key={pred.item} className="prediction-item">
                        <span>{pred.item}</span>
                        <ProgressBar value={pred.retention_probability * 100} />
                        <span>Revisar: {formatDate(pred.recommended_review_date)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

---

### **🚀 FASE 6: DEPLOYMENT Y OPTIMIZACIÓN (Semanas 11-12)**

#### **Semana 11: Testing y Optimización**

**Día 51-52: Testing Completo**
```python
# tests/test_integration.py
class IntegrationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('test@example.com')
        self.space = Space.objects.create(user=self.user, name='Test Space')
        
    def test_complete_learning_flow(self):
        """Test del flujo completo de aprendizaje"""
        # 1. Subir documento
        response = self.client.post('/api/upload/', {
            'file': self.get_test_pdf(),
            'space_id': self.space.id
        })
        self.assertEqual(response.status_code, 201)
        
        # 2. Generar preguntas
        document = Document.objects.last()
        generator = QuestionGenerator()
        questions = generator.generate_all_types(document)
        
        # 3. Crear sesión de estudio
        session_manager = SessionManager()
        session, items = session_manager.create_session(
            self.user, self.space, 'quick', 'MIXED'
        )
        
        # 4. Simular respuestas
        for item in items:
            attempt = CoreAttempt.objects.create(
                user=self.user,
                session=session,
                content_object=item,
                correct=random.choice([True, False])
            )
        
        # 5. Calcular XP
        xp_manager = XPManager()
        xp = xp_manager.calculate_session_xp(session)
        self.assertGreater(xp, 0)
        
        # 6. Verificar progreso
        progress = CoreLearningProgress.objects.filter(user=self.user)
        self.assertGreater(progress.count(), 0)

# tests/test_performance.py
class PerformanceTestCase(TestCase):
    def test_query_optimization(self):
        """Verificar que no hay consultas N+1"""
        with self.assertNumQueries(3):
            spaces = Space.objects.prefetch_related(
                'spaceitem_set__content_object'
            ).filter(user=self.user)
            
            for space in spaces:
                for item in space.spaceitem_set.all():
                    # Acceder a content_object no debe generar queries adicionales
                    _ = item.content_object
```

**Día 53-54: Optimización de Performance**
```python
# core/optimizations.py
from django.core.cache import cache
from django.views.decorators.cache import cache_page

# Cache de queries frecuentes
def get_user_progress_cached(user, space):
    cache_key = f'progress_{user.id}_{space.id}'
    progress = cache.get(cache_key)
    
    if progress is None:
        progress = CoreLearningProgress.objects.filter(
            user=user,
            content_object__in=space.get_all_items()
        ).select_related('content_type')
        
        cache.set(cache_key, progress, 300)  # 5 minutos
    
    return progress

# Optimización de bulk operations
def bulk_create_questions(document, questions_data):
    mcqs = []
    clozes = []
    
    for data in questions_data:
        if data['type'] == 'mcq':
            mcqs.append(APIMcq(document=document, **data))
        elif data['type'] == 'cloze':
            clozes.append(APICloze(document=document, **data))
    
    APIMcq.objects.bulk_create(mcqs)
    APICloze.objects.bulk_create(clozes)

# Índices de base de datos
class Migration(migrations.Migration):
    operations = [
        migrations.AddIndex(
            model_name='corelearningprogress',
            index=models.Index(
                fields=['user', 'next_review_at'],
                name='idx_progress_review'
            )
        ),
        migrations.AddIndex(
            model_name='coreattempt',
            index=models.Index(
                fields=['session', 'created_at'],
                name='idx_attempt_session_date'
            )
        )
    ]
```

**Día 55: Configuración de Caché y CDN**
```python
# settings/production.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PARSER_CLASS': 'redis.connection.HiredisParser',
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
        }
    }
}

# CDN para archivos estáticos
AWS_S3_CUSTOM_DOMAIN = 'cdn.studyai.com'
STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/static/'
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'

# Compresión de respuestas
MIDDLEWARE += [
    'django.middleware.gzip.GZipMiddleware',
    'corsheaders.middleware.CorsMiddleware',
]
```

#### **Semana 12: Deployment y Monitoreo**

**Día 56-57: Dockerización**
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Configurar entorno
ENV DJANGO_SETTINGS_MODULE=settings.production
ENV PYTHONUNBUFFERED=1

# Ejecutar migraciones y collectstatic
RUN python manage.py collectstatic --noinput

# Exponer puerto
EXPOSE 8000

# Comando de inicio
CMD ["gunicorn", "myproject.wsgi:application", "--bind", "0.0.0.0:8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: studyai
      POSTGRES_USER: studyai
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  web:
    build: .
    command: gunicorn myproject.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - .:/app
      - static_volume:/app/static
      - media_volume:/app/media
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    environment:
      - DATABASE_URL=postgresql://studyai:${DB_PASSWORD}@db:5432/studyai
      - REDIS_URL=redis://redis:6379/0

  celery:
    build: .
    command: celery -A myproject worker -l info
    volumes:
      - .:/app
    depends_on:
      - db
      - redis

  celery-beat:
    build: .
    command: celery -A myproject beat -l info
    volumes:
      - .:/app
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - static_volume:/static
      - media_volume:/media
      - ./certbot/conf:/etc/letsencrypt
    depends_on:
      - web

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

**Día 58-59: CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-django
      
      - name: Run tests
        run: pytest
      
      - name: Run linting
        run: |
          pip install flake8
          flake8 .

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/studyai
            git pull origin main
            docker-compose down
            docker-compose up -d --build
            docker-compose exec web python manage.py migrate
```

**Día 60: Monitoreo y Observabilidad**
```python
# monitoring/sentry_config.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn=os.environ.get('SENTRY_DSN'),
    integrations=[
        DjangoIntegration(),
        CeleryIntegration(),
    ],
    traces_sample_rate=0.1,
    send_default_pii=False,
    environment=os.environ.get('ENVIRONMENT', 'production')
)

# monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Métricas personalizadas
api_requests = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint'])
api_latency = Histogram('api_latency_seconds', 'API latency')
active_users = Gauge('active_users', 'Currently active users')
ai_credits_consumed = Counter('ai_credits_consumed', 'Total AI credits consumed')

# Middleware para métricas
class MetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        api_requests.labels(
            method=request.method,
            endpoint=request.path
        ).inc()
        
        with api_latency.time():
            response = self.get_response(request)
        
        return response
```

---

## **📊 RESUMEN DEL ROADMAP**

### Cronograma Total: 12 Semanas

| Fase | Semanas | Entregables Clave |
|------|---------|-------------------|
| **Fundación** | 1-2 | Base de datos migrada, APIs básicas |
| **Métodos de Aprendizaje** | 3-4 | Cloze, Feynman, Sesiones unificadas |
| **Gamificación** | 5-6 | XP, Streaks, Leaderboard |
| **Suscripciones** | 7-8 | Stripe, Créditos AI, Límites |
| **Learning Paths** | 9-10 | Generador AI, Kanban, Reportes |
| **Deployment** | 11-12 | Docker, CI/CD, Monitoreo |

### Recursos Necesarios

**Equipo Mínimo:**
- 1 Full-Stack Developer (tú)
- 1 Designer UI/UX (part-time)
- 1 QA Tester (últimas 2 semanas)

**Costos Estimados Mensuales:**
- Infraestructura AWS/GCP: $100-300
- APIs (OpenAI, Anthropic): $50-200
- Herramientas (Sentry, etc.): $50
- **Total**: ~$200-550/mes

### KPIs de Éxito

1. **Técnicos:**
   - 90% cobertura de tests
   - < 200ms tiempo de respuesta API
   - 99.9% uptime

2. **Negocio:**
   - 20% conversión free → premium
   - 80% retención mensual
   - NPS > 50

3. **Educativos:**
   - 30% mejora en retención de conocimiento
   - 70% usuarios completan paths
   - 85% satisfacción con AI feedback

Este roadmap te da una guía completa y ejecutable para implementar todas las características en 12 semanas. ¿Necesitas que profundice en alguna fase específica?
