import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE","redlin_web.settings"); django.setup()
from rest_framework.test import APIClient
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from API.models import User, Document, Feynman
from CORE.models import CoreLearningProgress, CoreStudySession
u=User.objects.create(username="s10", email="s10@x.com", password="x")
doc=Document.objects.create(user=u, title="F doc")
fp=Feynman.objects.create(document=doc, prompt="Explain")
c=APIClient(); c.force_authenticate(user=u)
c.post("/api/study/feynman/", {"model":"feynman","seconds":200,"average":85,"scores":[{"item_id":fp.id,"score":85}]}, format="json")
ct=ContentType.objects.get_for_model(Feynman)
p=CoreLearningProgress.objects.get(user=u, content_type=ct, object_id=fp.id)
print("progress:", p.status, p.interval, "nextset:", p.next_review_at is not None)
assert p.status=="learning" and p.interval==3 and p.next_review_at is not None
assert u.xp_account.xp_total==20, u.xp_account.xp_total
p.next_review_at = timezone.now()-timezone.timedelta(hours=1); p.save()
due=c.get("/api/reminders/due/").json()
assert due["items"] and due["items"][0]["method"]=="FEYNMAN"
print("due:", due["items"][0]["method"], "| sessions:", CoreStudySession.objects.count())
print("FEYNMAN SR SMOKE OK")
PY
timeout 200 docker run --rm --entrypoint sh -v "$PWD:/app" -w /app redlin-backend -c "python manage.py migrate --noinput >/dev/null 2>&1 && python -m pytest CORE/tests/services/test_srs.py -q 2>&1 | tail -3 && python _smoke.py" 2>&1 | tail -12
rm -f db.sqlite3 _smoke.py
