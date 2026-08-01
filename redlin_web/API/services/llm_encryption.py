"""Fernet encryption for per-user LLM API keys.

Keys are encrypted at rest (only the ciphertext column persists) and decrypted
in memory just before a generation call. The plaintext is never written to the
DB and never returned over the API.
"""
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet() -> Fernet:
    return Fernet(settings.LLM_ENCRYPTION_KEY.encode("ascii"))


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt a plaintext key; returns the ciphertext string ("" if empty)."""
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_api_key(ciphertext: str) -> str:
    """Decrypt a stored ciphertext; returns "" if empty or undecryptable.

    An undecryptable value (e.g. the Fernet key rotated) degrades gracefully to
    the server-default Gemini key rather than crashing the request.
    """
    if not ciphertext:
        return ""
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
