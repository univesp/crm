import json
import uuid
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import now_datetime

from univesp_atendimento.api.v1 import knowledge_runtime, knowledge_v3, routing
from univesp_atendimento.api.v1.common import RequestContext


class TestKnowledgeRuntime(IntegrationTestCase):
	def setUp(self):
		suffix = uuid.uuid4().hex[:8]
		self.bundle_key = f"runtime-{suffix}"
		self.theme_key = self.bundle_key
		self.session_id = str(uuid.uuid4())
		self.binding_hash = "a" * 64
		self.context = RequestContext(
			email="runtime.student@aluno.univesp.br",
			name="Runtime Student",
			ra="",
			profile_key="aluno",
			scopes={},
			actions=frozenset({"create_ticket"}),
			request_id=f"request-{suffix}",
			actor_email="runtime.student@aluno.univesp.br",
		)
		frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Theme Governance",
				"theme_key": self.theme_key,
				"theme_label": "Runtime",
				"owner_email": "owner.runtime@univesp.br",
				"approver_group": f"approvers-{suffix}",
				"editor_areas": [{"area_key": "sra", "area_label": "SRA", "can_edit_draft": 1}],
				"active": 1,
			}
		).insert(ignore_permissions=True, ignore_links=True)
		self.bundle = frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Bundle",
				"bundle_key": self.bundle_key,
				"title": "Runtime",
				"theme_key": self.theme_key,
				"audience_profile": "student",
				"status": "active",
				"created_by_email": "author.runtime@univesp.br",
				"created_at": now_datetime(),
			}
		).insert(ignore_permissions=True)
		self.version = self._insert_published_version("version-1")
		frappe.db.set_value(
			"Univesp Knowledge Bundle",
			self.bundle.name,
			"published_version",
			self.version.name,
			update_modified=False,
		)
		settings = frappe.get_single("Univesp Runtime Settings")
		settings.knowledge_v3_read = 1
		settings.knowledge_session_ttl_seconds = 7200
		settings.save(ignore_permissions=True)

	def tearDown(self):
		frappe.cache().delete_value(f"{knowledge_runtime.SESSION_PREFIX}{self.session_id}")

	def _payload(self):
		return {
			"schema_version": "3.0.0",
			"bundle_key": self.bundle_key,
			"theme_key": self.theme_key,
			"metadata": {
				"title": "Runtime",
				"audience_profile": "student",
				"criticidade_default_key": "media",
				"sla_policy_key": "48h",
			},
			"graph": {
				"student_root_node_id": "root",
				"public_root_node_id": None,
				"internal_root_node_id": None,
			},
			"routing_policy": {
				"pattern_key": "op_then_area",
				"bpo_enabled": False,
				"steps": ["op", "area"],
			},
			"nodes": [
				{
					"node_id": "root",
					"stable_key": "root",
					"node_kind": "path",
					"audiences": ["student"],
					"display": {"title": "Runtime"},
					"content": {"student": {"blocks": []}, "public": None},
					"playbooks": {"op": None, "bpo": None, "analyst": None},
				},
				{
					"node_id": "final",
					"stable_key": "final",
					"node_kind": "final",
					"audiences": ["student"],
					"display": {"title": "Final"},
					"content": {
						"student": {
							"blocks": [{"block_id": "b1", "type": "text", "body": "Resposta"}],
							"outcome_key": "open_ticket",
						},
						"public": None,
					},
					"playbooks": {
						"op": {"objective": "Resolver"},
						"bpo": None,
						"analyst": None,
					},
				},
			],
			"edges": [
				{
					"edge_id": "root-final",
					"parent_node_id": "root",
					"child_node_id": "final",
					"order": 1,
					"active": True,
					"audiences": ["student"],
				}
			],
		}

	def _insert_published_version(self, label):
		return frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Version",
				"version_id": f"{self.bundle_key}-{label}",
				"bundle": self.bundle.name,
				"version_label": label,
				"revision": 1,
				"lifecycle_state": "published",
				"payload_json": json.dumps(self._payload(), ensure_ascii=False),
				"change_summary": "Versão de teste do runtime",
				"author_email": "author.runtime@univesp.br",
				"approver_email": "approver.runtime@univesp.br",
				"publisher_email": "publisher.runtime@univesp.br",
				"approved_at": now_datetime(),
				"published_at": now_datetime(),
				"timezone": "America/Sao_Paulo",
			}
		).insert(ignore_permissions=True)

	def test_sticky_version_path_and_event_idempotency(self):
		with patch.object(knowledge_runtime, "get_request_context", return_value=self.context):
			started = knowledge_runtime.start_session(
				{
					"faq_session_id": self.session_id,
					"binding_hash": self.binding_hash,
					"bundle_key": self.bundle_key,
					"bundle_version_id": self.version.version_id,
					"persona": "student",
					"origin": "portal",
				}
			)["data"]
			self.assertEqual(started["path"], ["root"])
			advanced = knowledge_runtime.advance_session(
				self.session_id,
				{
					"binding_hash": self.binding_hash,
					"node_id": "final",
					"path": ["root", "final"],
					"event_id": str(uuid.uuid4()),
				},
			)["data"]
			self.assertEqual(advanced["path"], ["root", "final"])

			old_version_id = started["bundle_version_id"]
			self.version.lifecycle_state = "superseded"
			self.version.superseded_at = now_datetime()
			knowledge_v3._save_transition(self.version)
			new_version = self._insert_published_version("version-2")
			frappe.db.set_value(
				"Univesp Knowledge Bundle",
				self.bundle.name,
				"published_version",
				new_version.name,
				update_modified=False,
			)
			resumed = knowledge_runtime.get_session(self.session_id, self.binding_hash)["data"]
			self.assertEqual(resumed["bundle_version_id"], old_version_id)

			event_id = str(uuid.uuid4())
			payload = {
				"event_id": event_id,
				"event_name": "faq.ticket_open_started",
				"faq_session_id": self.session_id,
				"binding_hash": self.binding_hash,
				"node_id": "final",
			}
			first = knowledge_runtime.record_event(payload)["data"]
			second = knowledge_runtime.record_event(payload)["data"]
			self.assertEqual(first["event_id"], second["event_id"])
			self.assertEqual(
				frappe.db.count("Univesp Knowledge Event", {"event_id": event_id}),
				1,
			)

			lineage = knowledge_runtime.validate_session_lineage(
				{
					"faq_session_id": self.session_id,
					"binding_hash": self.binding_hash,
					"bundle_id": self.bundle_key,
					"bundle_version_id": old_version_id,
					"node_id": "final",
					"path": ["root", "final"],
				},
				self.context,
			)
			self.assertEqual(lineage["path"], ["root", "final"])

	def test_preview_and_ticket_creation_share_the_same_route_decision(self):
		pattern = {
			"pattern_key": "op_then_area",
			"steps": ["op", "area"],
			"allowed_routing_keys": ["atendimento-geral"],
			"institutional_exceptions": ["provas", "critica"],
		}
		session_record = {
			"bundle_version_id": self.version.version_id,
			"path": ["root", "final"],
		}
		with (
			patch.object(routing, "_pattern", return_value=pattern),
			patch.object(routing, "_queue_exists", return_value=True),
		):
			preview_decision = routing._resolve_v3(self._payload(), "final", {}).as_dict()
			ticket_decision = routing.resolve_ticket_route(
				session_record=session_record,
				knowledge={},
				student={},
				context=self.context,
			)
		self.assertEqual(ticket_decision, preview_decision)
