from django.test import TestCase
from django.utils import timezone
from API.models import User
from .models import CoreXpAccount, CoreXpAward


class CoreXpAccountSignalTest(TestCase):
	def test_xp_account_auto_created_on_user_creation(self):
		user = User.objects.create()  # Asumimos que no hay campos obligatorios adicionales
		self.assertTrue(hasattr(user, 'xp_account'))
		self.assertIsInstance(user.xp_account, CoreXpAccount)
		self.assertEqual(user.xp_account.level, 1)
		self.assertEqual(user.xp_account.xp_total, 0)


class CoreXpAccountLevelCalculationTest(TestCase):
	def setUp(self):
		self.user = User.objects.create()
		self.account = self.user.xp_account

	def test_level_boundaries(self):
		# Nivel 1: < 1000
		self.account.xp_total = 999
		self.account.calculate_level()
		self.assertEqual(self.account.level, 1)

		# Nivel 2: >= 1000 y < 3000 (1000 + 2000)
		self.account.xp_total = 1000
		self.account.calculate_level()
		self.assertEqual(self.account.level, 2)
		self.account.xp_total = 2999
		self.account.calculate_level()
		self.assertEqual(self.account.level, 2)

		# Nivel 3: >= 3000 y < 6000 (1000 + 2000 + 3000)
		self.account.xp_total = 3000
		self.account.calculate_level()
		self.assertEqual(self.account.level, 3)
		self.account.xp_total = 5999
		self.account.calculate_level()
		self.assertEqual(self.account.level, 3)

	def test_add_xp_and_level_up(self):
		self.account.add_xp(1000)  # Sube a nivel 2
		self.assertEqual(self.account.level, 2)
		self.account.add_xp(2000)  # 1000 + 2000 => nivel 3
		self.assertEqual(self.account.level, 3)

	def test_add_xp_negative_ignored(self):
		self.account.xp_total = 500
		self.account.add_xp(-100)
		self.assertEqual(self.account.xp_total, 500)


class CoreXpAwardTest(TestCase):
	def setUp(self):
		self.user = User.objects.create()
		self.account = self.user.xp_account

	def test_create_award_and_manual_apply(self):
		award = CoreXpAward.objects.create(user=self.user, amount=150, reason='quick_pass')
		self.assertEqual(award.amount, 150)
		# Aplicar XP manualmente (la lógica de award_xp estará en un servicio futuro)
		prev_level = self.account.level
		self.account.add_xp(award.amount)
		self.account.save()
		self.assertGreaterEqual(self.account.xp_total, 150)
		self.assertTrue(self.account.level >= prev_level)

	def test_multiple_awards_accumulate(self):
		amounts = [400, 300, 500]
		total = sum(amounts)
		for a in amounts:
			CoreXpAward.objects.create(user=self.user, amount=a, reason='test')
			self.account.add_xp(a)
		self.account.save()
		self.assertEqual(self.account.xp_total, total)
		# 400+300+500 = 1200 => debe ser nivel 2 (>=1000 pero <3000)
		self.assertEqual(self.account.level, 2)
