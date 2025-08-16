from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory, force_authenticate

from API.models import User
from .views import CSVImportViewSet, CSVFlashcardViewSet
from .models import CSVFlashcard


class CSVFlowTests(TestCase):
	def setUp(self):
		self.user = User.objects.create(username='u', email='e@example.com', password='x')
		self.factory = APIRequestFactory()

	def test_import_and_study_flow(self):
		content = b"keyword,definition\nPython,Programming language\nDjango,Web framework"
		upload = SimpleUploadedFile("cards.csv", content, content_type="text/csv")

		view = CSVImportViewSet.as_view({'post': 'upload'})
		request = self.factory.post('/api/csv/imports/upload', {'file': upload}, format='multipart')
		force_authenticate(request, user=self.user)
		response = view(request)
		self.assertEqual(response.status_code, 201)
		self.assertEqual(CSVFlashcard.objects.filter(user=self.user).count(), 2)

		# Study list should return two items
		view2 = CSVFlashcardViewSet.as_view({'get': 'study'})
		request2 = self.factory.get('/api/csv/flashcards/study?limit=10')
		force_authenticate(request2, user=self.user)
		response2 = view2(request2)
		self.assertEqual(response2.status_code, 200)
		self.assertEqual(len(response2.data), 2)


# Create your tests here.
