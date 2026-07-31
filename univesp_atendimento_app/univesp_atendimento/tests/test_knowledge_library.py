from datetime import datetime
from unittest import TestCase

from univesp_atendimento.api.v1.knowledge import (
	KnowledgeLibraryValidationError,
	_is_publication_active,
	_library_summary,
	_validate_library,
)


def _library(*bundles):
	return {
		"schemaVersion": "faq-builder-library-v1",
		"bundles": list(bundles),
	}


def _bundle(bundle_id="bundle:aluno:matricula"):
	return {"bundleId": bundle_id, "workspace": {"workflowStatus": "Draft"}}


class TestKnowledgeLibrary(TestCase):
	def test_accepts_canonical_library(self):
		encoded = _validate_library(_library(_bundle()))
		self.assertIn(b'"faq-builder-library-v1"', encoded)

	def test_rejects_duplicate_bundle_ids(self):
		with self.assertRaises(KnowledgeLibraryValidationError):
			_validate_library(_library(_bundle(), _bundle()))

	def test_rejects_invalid_workspace(self):
		with self.assertRaises(KnowledgeLibraryValidationError):
			_validate_library(_library({"bundleId": "bundle:invalid", "workspace": None}))

	def test_rejects_payload_above_two_mebibytes(self):
		with self.assertRaises(KnowledgeLibraryValidationError):
			_validate_library(
				_library(
					{
						"bundleId": "bundle:oversized",
						"workspace": {"draftBundle": {"content": "x" * (2 * 1024 * 1024)}},
					}
				)
			)

	def test_publication_respects_effective_window(self):
		current = datetime(2026, 7, 20, 12, 0, 0)
		self.assertTrue(
			_is_publication_active(
				{"effectiveStartAt": "2026-07-20 10:00:00", "effectiveEndAt": "2026-07-20 14:00:00"},
				{},
				current,
			)
		)
		self.assertFalse(_is_publication_active({"effectiveStartAt": "2026-07-21 10:00:00"}, {}, current))

	def test_audit_summary_uses_hash_instead_of_full_payload(self):
		summary = _library_summary(_library(_bundle()))
		self.assertEqual(summary["bundle_count"], 1)
		self.assertEqual(len(summary["sha256"]), 64)
		self.assertGreater(summary["bytes"], 0)
