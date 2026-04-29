from enum import Enum
from typing import Any

from rest_framework import status
from rest_framework.response import Response


class ErrorCode(str, Enum):
    """Stable error codes for API responses."""

    INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    REFRESH_TOKEN_REQUIRED = "AUTH_REFRESH_TOKEN_REQUIRED"
    INVALID_TOKEN = "AUTH_INVALID_TOKEN"
    MISSING_BEARER_TOKEN = "AUTH_MISSING_BEARER_TOKEN"

    DOCUMENT_ALREADY_PROCESSED = "DOC_ALREADY_PROCESSED"

    FEYNMAN_ID_REQUIRED = "FEYNMAN_ID_REQUIRED"
    FEYNMAN_ID_INVALID = "FEYNMAN_ID_INVALID"
    FEYNMAN_NOT_FOUND = "FEYNMAN_NOT_FOUND"

    CLOZE_NOT_FOUND = "CLOZE_NOT_FOUND"


class ApiError(Exception):
    """Domain-level API error that can be rendered as a DRF response."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

    def to_payload(self) -> dict[str, Any]:
        # Keep legacy keys (`error` and `detail`) for backwards compatibility.
        payload: dict[str, Any] = {
            "error": self.message,
            "detail": self.message,
            "error_code": self.code.value,
        }
        if self.details:
            payload["details"] = self.details
        return payload


def error_response(error: ApiError) -> Response:
    return Response(error.to_payload(), status=error.status_code)
