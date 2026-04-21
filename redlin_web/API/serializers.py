"""Compatibility alias for plural serializer module naming.

Django and DRF conventions typically use serializers.py. This module re-exports
from the existing serializer.py to keep backward compatibility while enabling
new imports to follow standard naming.
"""

from .serializer import *  # noqa: F401,F403
