from pathlib import Path
from unittest import TestCase


PATCH_PATH = (
	Path(__file__).resolve().parents[1]
	/ "patches"
	/ "v0_4"
	/ "protect_student_directory_cpf.py"
)


class TestProtectStudentDirectoryCpfPatch(TestCase):
	def test_syncs_doctype_before_querying_new_hash_field(self):
		source = PATCH_PATH.read_text(encoding="utf-8")

		self.assertLess(
			source.index("frappe.reload_doc("),
			source.index("frappe.get_all("),
		)
		self.assertIn('"univesp_student_directory"', source)
		self.assertIn("force=True", source)
