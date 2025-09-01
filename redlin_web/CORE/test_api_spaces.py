from django.test import TestCase
from rest_framework.test import APIClient
from API.models import User
from .models import Space


def auth_headers(user):
    # Reuse login logic by directly creating tokens via jwt_auth to avoid extra HTTP call
    from API.jwt_auth import create_tokens
    access, refresh = create_tokens(user.id)
    return {'HTTP_AUTHORIZATION': f'Bearer {access}'}


class SpaceAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='u1', email='u1@example.com', password='pwd')
        self.other = User.objects.create(username='u2', email='u2@example.com', password='pwd')
        self.client = APIClient()

    def test_create_list_detail_update_delete(self):
        # Create
        resp = self.client.post('/api/spaces/', {'name': 'My Space', 'description': 'Desc'}, format='json', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 201, resp.content)
        sid = resp.data['id']
        # List returns the new space
        resp = self.client.get('/api/spaces/', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)
        # Detail
        resp = self.client.get(f'/api/spaces/{sid}/', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 200)
        # Update
        resp = self.client.patch(f'/api/spaces/{sid}/', {'description': 'Updated'}, format='json', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['description'], 'Updated')
        # Delete
        resp = self.client.delete(f'/api/spaces/{sid}/', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 204)
        # Now list empty
        resp = self.client.get('/api/spaces/', **auth_headers(self.user))
        self.assertEqual(resp.data['count'], 0)

    def test_isolated_user_access(self):
        s1 = Space.objects.create(user=self.user, name='A')
        Space.objects.create(user=self.other, name='B')
        resp = self.client.get('/api/spaces/', **auth_headers(self.user))
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['name'], 'A')
        # Attempt to access other's space returns 404
        resp = self.client.get(f'/api/spaces/{s1.id + 1}/', **auth_headers(self.user))
        self.assertEqual(resp.status_code, 404)

    def test_search_and_ordering(self):
        Space.objects.create(user=self.user, name='Alpha', description='first')
        Space.objects.create(user=self.user, name='Beta', description='second')
        Space.objects.create(user=self.user, name='Gamma test', description='third')
        resp = self.client.get('/api/spaces/?search=test', **auth_headers(self.user))
        names = [r['name'] for r in resp.data['results']]
        self.assertIn('Gamma test', names)
        # Ordering asc by name
        resp = self.client.get('/api/spaces/?ordering=name', **auth_headers(self.user))
        names_ordered = [r['name'] for r in resp.data['results']]
        self.assertEqual(names_ordered, sorted(names_ordered))

    def test_filter_visibility(self):
        Space.objects.create(user=self.user, name='Priv', visibility='private')
        Space.objects.create(user=self.user, name='Unl', visibility='unlisted')
        resp = self.client.get('/api/spaces/?visibility=unlisted', **auth_headers(self.user))
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['visibility'], 'unlisted')
