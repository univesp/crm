from unittest import TestCase

from univesp_atendimento.link_validation import classify_link


class TestLinkValidation(TestCase):
	def test_verifies_matching_academic_identity(self):
		self.assertEqual(
			classify_link(
				{"email": "aluno@x.br", "ra": "123", "curso": "Pedagogia", "polo_id": "gru"},
				{"email": "ALUNO@x.br", "ra": "123", "curso": "pedagogia", "polo": "GRU"},
			),
			"verified",
		)

	def test_marks_conflict_without_revealing_which_field(self):
		self.assertEqual(
			classify_link(
				{"email": "aluno@x.br", "ra": "123", "curso": "Pedagogia", "polo_id": "gru"},
				{"email": "aluno@x.br", "ra": "999", "curso": "Pedagogia", "polo": "gru"},
			),
			"conflicting",
		)

	def test_requires_two_independent_matches(self):
		self.assertEqual(
			classify_link({"email": "aluno@x.br"}, {"email": "aluno@x.br"}),
			"inconclusive",
		)
