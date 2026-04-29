from django.contrib.contenttypes.models import ContentType
from rest_framework import status

from API.errors import ApiError, ErrorCode
from API.feynman_ai import evaluate_document_feynman_attempt
from API.models import Feynman, FeynmanAttempt, User
from CORE.models import CoreAttempt


def parse_feynman_id(raw_value: object) -> int:
    if raw_value in (None, ""):
        raise ApiError(
            code=ErrorCode.FEYNMAN_ID_REQUIRED,
            message="feynman_id requerido",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ApiError(
            code=ErrorCode.FEYNMAN_ID_INVALID,
            message="feynman_id invalido",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"feynman_id": raw_value},
        ) from exc


def get_document_feynman_or_error(document_id: int, raw_feynman_id: object) -> Feynman:
    feynman_id = parse_feynman_id(raw_feynman_id)
    f_obj = Feynman.objects.filter(id=feynman_id, document_id=document_id).first()
    if not f_obj:
        raise ApiError(
            code=ErrorCode.FEYNMAN_NOT_FOUND,
            message="Feynman no encontrado",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"feynman_id": feynman_id, "document_id": document_id},
        )
    return f_obj


def get_owned_feynman_or_error(user: User, raw_feynman_id: object) -> Feynman:
    feynman_id = parse_feynman_id(raw_feynman_id)
    f_obj = Feynman.objects.filter(id=feynman_id, document__user=user).first()
    if not f_obj:
        raise ApiError(
            code=ErrorCode.FEYNMAN_NOT_FOUND,
            message="Feynman no encontrado",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"feynman_id": feynman_id},
        )
    return f_obj


def evaluate_and_record_attempt(*, f_obj: Feynman, answer: str, user: User) -> FeynmanAttempt:
    attempt = evaluate_document_feynman_attempt(f_obj, answer, user)
    _register_core_attempt(user=user, attempt=attempt)
    return attempt


def _register_core_attempt(*, user: User, attempt: FeynmanAttempt) -> None:
    try:
        content_type = ContentType.objects.get_for_model(FeynmanAttempt)
        CoreAttempt.objects.create(
            user=user,
            method="FEYNMAN",
            content_type=content_type,
            object_id=attempt.id,
            raw_answer=attempt.answer_text,
            ai_score=attempt.score,
            ai_feedback=attempt.breakdown or {},
            correct=(attempt.score or 0) >= 60,
        )
    except Exception as exc:
        print(f"[CoreAttempt] Error creando registro: {exc}")
