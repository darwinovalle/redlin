"""Per-user timezone helpers.

The browser supplies the IANA zone name (e.g. "America/Bogota") and the server
stores it on the User model. All day-boundary logic (streak "today", reminder
scan, calendar day folding) goes through these helpers so a user in Colombia
gets local days regardless of the container running in UTC.
"""
from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone

DEFAULT_TZ = "UTC"


def user_zone(user):
    """Return the user's ZoneInfo, falling back to UTC on invalid names."""
    name = getattr(user, "timezone", None) or DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except Exception:
        # Invalid/unrecognized IANA name or an older tzdata — degrade gracefully.
        # NOTE: use ZoneInfo, not django.utils.timezone.utc (removed in Django 5).
        return ZoneInfo("UTC")


def user_now(user):
    """Current time in the user's zone (timezone-aware)."""
    return timezone.now().astimezone(user_zone(user))


def local_today(user):
    """The user's local calendar date right now."""
    return user_now(user).date()


def local_day_bounds(user):
    """UTC datetime bounds covering the user's local today, plus that date."""
    zone = user_zone(user)
    day = timezone.now().astimezone(zone).date()
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = start + timedelta(days=1)
    return start.astimezone(dt_timezone.utc), end.astimezone(dt_timezone.utc), day