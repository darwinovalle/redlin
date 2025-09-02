import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from VIDEO.models import Video, VideoCloze
from API.models import User

@pytest.mark.django_db
class TestVideoClozeAPI:
    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def test_user(self):
        return User.objects.create(username='videouser', password='pass', email='v@example.com')

    @pytest.fixture
    def authenticated_client(self, api_client, test_user):
        api_client.force_authenticate(user=test_user)
        return api_client

    @pytest.fixture
    def test_video(self, test_user):
        return Video.objects.create(user=test_user, url="http://example.com/video.mp4")

    @pytest.fixture
    def video_cloze(self, test_video):
        return VideoCloze.objects.create(
            video=test_video,
            text_with_blank="A video is a sequence of ____.",
            answer="images"
        )

    def test_validate_video_cloze_correct(self, authenticated_client, video_cloze):
        url = reverse('cloze-validate')
        data = {
            "cloze_id": video_cloze.id,
            "answer": "images",
            "cloze_type": "video"
        }
        response = authenticated_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['correct'] is True
        assert response.data['cloze_id'] == video_cloze.id

    def test_validate_video_cloze_incorrect(self, authenticated_client, video_cloze):
        url = reverse('cloze-validate')
        data = {
            "cloze_id": video_cloze.id,
            "answer": "sounds",
            "cloze_type": "video"
        }
        response = authenticated_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['correct'] is False
