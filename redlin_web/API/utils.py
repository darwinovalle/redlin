from django.utils import timezone


def apply_review(card, quality: int):
    """Update an API Flashcard instance based on a 0..5 quality rating.

    Implements a simplified SM-2 scheduling.
    """
    q = max(0, min(5, int(quality)))

    card.times_shown += 1
    card.repetitions = card.repetitions + 1 if q >= 3 else 0

    # Update easiness factor (EF)
    card.easiness = max(1.3, card.easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

    if q < 3:
        card.interval = 0
        card.next_review_at = None
        card.status = 'still_learning'
    else:
        if card.repetitions == 1:
            _schedule_for(card, 1)
        elif card.repetitions == 2:
            _schedule_for(card, 6)
        else:
            next_days = round(card.interval * card.easiness) if card.interval > 0 else 6
            _schedule_for(card, max(1, next_days))
        if card.repetitions >= 5 and card.easiness >= 2.5:
            card.status = 'mastered'

    # Bound 0..1 mastery score using EF and repetitions
    card.score = max(0.0, min(1.0, (card.easiness - 1.3) / (2.7 - 1.3) * (1 - 2 ** (-card.repetitions / 3))))

    return card


def _schedule_for(card, days: int):
    card.interval = max(1, int(days))
    card.next_review_at = timezone.now() + timezone.timedelta(days=card.interval)
