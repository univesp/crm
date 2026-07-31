from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from univesp_atendimento.ticket_protocol import persist_ticket_protocol


class TestTicketProtocol(TestCase):
	def test_persists_without_updating_modified_timestamp(self):
		database = Mock()
		frappe = SimpleNamespace(db=database)
		doc = SimpleNamespace(name="HD-TICKET-0001", custom_univesp_protocol="")

		result = persist_ticket_protocol(frappe, doc, "PRT-2026-000001")

		database.set_value.assert_called_once_with(
			"HD Ticket",
			"HD-TICKET-0001",
			"custom_univesp_protocol",
			"PRT-2026-000001",
			update_modified=False,
		)
		self.assertEqual(doc.custom_univesp_protocol, "PRT-2026-000001")
		self.assertEqual(result, "PRT-2026-000001")
