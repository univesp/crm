"""Testes unitarios — channel adapter e ingress (Fase C)."""

from __future__ import annotations

import unittest

from univesp_atendimento.academic_query import StubAcademicQueryService
from univesp_atendimento.channel_adapter import ChannelAdapterError, normalize_channel_payload
from univesp_atendimento.channel_ingress import self_test


class ChannelAdapterTests(unittest.TestCase):
	def test_normalizes_email_shape(self):
		payload = {
			"channel": "email",
			"subject": "Duvida matricula",
			"description": "Preciso de ajuda",
			"student": {"email": "aluno@aluno.univesp.br", "ra": "HOMOLOG001"},
			"queue": "atendimento-geral",
		}
		result = normalize_channel_payload(payload)
		self.assertEqual(result["channel"], "email")
		self.assertEqual(result["student"]["ra"], "HOMOLOG001")

	def test_rejects_invalid_channel(self):
		with self.assertRaises(ChannelAdapterError):
			normalize_channel_payload({"channel": "telegram", "subject": "x", "description": "y"})

	def test_requires_subject(self):
		with self.assertRaises(ChannelAdapterError):
			normalize_channel_payload({"channel": "whatsapp", "description": "y"})

	def test_preserves_complete_faq_lineage(self):
		result = normalize_channel_payload(
			{
				"channel": "email",
				"subject": "Duvida de acesso",
				"description": "Preciso de ajuda",
				"faq_context": {
					"bundle_id": "bundle:acesso",
					"bundle_version_id": "v3.0",
					"path": ["acesso-root", "acesso-final"],
				},
			}
		)
		self.assertEqual(
			result["knowledge"],
			{
				"bundle_id": "bundle:acesso",
				"bundle_version_id": "v3.0",
				"node_id": "acesso-final",
				"path": ["acesso-root", "acesso-final"],
				"audience": "",
				"faq_session_id": "",
				"resolved": False,
			},
		)


class AcademicStubTests(unittest.TestCase):
	def test_homolog001_returns_data(self):
		service = StubAcademicQueryService()
		summary = service.get_student_summary("HOMOLOG001")
		self.assertEqual(summary["status"], "active")
		self.assertEqual(len(service.list_current_disciplines("HOMOLOG001")), 2)

	def test_unknown_ra_unavailable(self):
		service = StubAcademicQueryService()
		summary = service.get_student_summary("UNKNOWN999")
		self.assertEqual(summary["status"], "unavailable")


class ChannelIngressSelfTest(unittest.TestCase):
	def test_self_test_passes_normalize(self):
		result = self_test()
		self.assertTrue(result["ok"])


if __name__ == "__main__":
	unittest.main()
