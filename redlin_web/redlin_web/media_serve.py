"""Range-aware media serving.

Django's ``static()`` / ``django.views.static.serve`` ignores HTTP ``Range``
headers, which breaks HTML5 ``<video>/<audio>`` playback: browsers need ``206
Partial Content`` responses to stream and seek — and to read metadata for MP4s
whose ``moov`` atom lives at the end of the file. This view serves files under
``MEDIA_ROOT`` with single-byte-range support, which is the only kind browsers
use. (Production nginx already handles ranges; this covers dev/self-hosted.)
"""
import mimetypes
import os
import re

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class _LimitedReader:
    """Yield at most ``remaining`` bytes from ``fileobj`` in chunks (streaming)."""

    def __init__(self, fileobj, remaining: int):
        self.file = fileobj
        self.remaining = remaining

    def __iter__(self):
        chunk = 64 * 1024
        while self.remaining > 0:
            data = self.file.read(min(chunk, self.remaining))
            if not data:
                break
            self.remaining -= len(data)
            yield data

    def close(self):
        self.file.close()


def serve_media(request, path: str):
    """Serve a file from MEDIA_ROOT, honoring a single HTTP Range request."""
    media_root = os.path.realpath(settings.MEDIA_ROOT)
    full_path = os.path.realpath(os.path.join(media_root, path))
    if not full_path.startswith(media_root + os.sep) or not os.path.isfile(full_path):
        raise Http404("File not found")

    size = os.path.getsize(full_path)
    start = 0
    end = size - 1

    match = _RANGE_RE.match(request.headers.get("Range", "").strip())
    is_range = bool(match and (match.group(1) or match.group(2)))
    if is_range:
        start_spec, end_spec = match.group(1), match.group(2)
        if start_spec:
            start = int(start_spec)
            end = int(end_spec) if end_spec else size - 1
        else:
            # Suffix range: "bytes=-N" → last N bytes.
            suffix = int(end_spec) if end_spec else size
            start = max(size - suffix, 0)
            end = size - 1
        end = min(end, size - 1)
        if start >= size or start > end:
            resp = HttpResponse(status=416)  # Requested Range Not Satisfiable
            resp["Content-Range"] = f"bytes */{size}"
            return resp

    length = end - start + 1
    fileobj = open(full_path, "rb")
    fileobj.seek(start)
    content_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    response = FileResponse(
        _LimitedReader(fileobj, length),
        content_type=content_type,
        status=206 if is_range else 200,
    )
    response["Content-Length"] = str(length)
    response["Accept-Ranges"] = "bytes"
    if is_range:
        response["Content-Range"] = f"bytes {start}-{end}/{size}"
    return response
