import unittest

from univesp_atendimento.academic_record_selection import collapse_students_by_email, pick_primary_enrollment


class TestAcademicRecordSelection(unittest.TestCase):
	def test_prefers_graduation_over_extension(self):
		rows = [
			{
				"email": "a@aluno.univesp.br",
				"curso": "Aperfeiçoamento em Gestão Escolar",
				"ra": "1600301.14",
				"matricula_codigo": "1600301.14",
				"polo_id": "237",
			},
			{
				"email": "a@aluno.univesp.br",
				"curso": "Licenciatura em Computação",
				"ra": "1600301.16",
				"matricula_codigo": "1600301.16",
				"polo_id": "237",
			},
		]
		primary, stats = pick_primary_enrollment(rows)
		self.assertEqual(primary["curso"], "Licenciatura em Computação")
		self.assertEqual(primary["enrollment_track"], "graduacao")
		self.assertEqual(stats["multi_active"], 1)

	def test_collapse_one_row_per_email(self):
		rows = [
			{"email": "a@aluno.univesp.br", "curso": "Extensão X", "ra": "1", "matricula_codigo": "1", "polo_id": "1"},
			{"email": "a@aluno.univesp.br", "curso": "Bacharelado Y", "ra": "2", "matricula_codigo": "2", "polo_id": "1"},
			{"email": "b@aluno.univesp.br", "curso": "Licenciatura Z", "ra": "3", "matricula_codigo": "3", "polo_id": "2"},
		]
		selected, report = collapse_students_by_email(rows)
		self.assertEqual(len(selected), 2)
		self.assertEqual(report["multi_active_emails"], 1)
		by_email = {row["email"]: row for row in selected}
		self.assertEqual(by_email["a@aluno.univesp.br"]["curso"], "Bacharelado Y")
