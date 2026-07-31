from unittest import TestCase

from univesp_atendimento.public_email_security import (
	parse_reply_recipient,
	sign_reply,
	verify_reply,
)


class TestPublicEmailSecurity(TestCase):
	def test_signed_recipient_round_trip(self):
		token = sign_reply("secret", "HD-TICKET-1", "Aluno@Example.com")
		ticket, parsed = parse_reply_recipient(f"reply+HD-TICKET-1.{token}@mail.example")
		self.assertEqual(ticket, "HD-TICKET-1")
		self.assertTrue(verify_reply("secret", ticket, "aluno@example.com", parsed))

	def test_rejects_tampered_protocol(self):
		token = sign_reply("secret", "HD-TICKET-1", "aluno@example.com")
		self.assertFalse(verify_reply("secret", "HD-TICKET-2", "aluno@example.com", token))
