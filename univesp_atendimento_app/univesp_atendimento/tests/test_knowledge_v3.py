import json
import uuid
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from univesp_atendimento.api.v1.common import RequestContext
from univesp_atendimento.api.v1 import knowledge_v3
from univesp_atendimento.api.v1.knowledge_v3 import (
	KnowledgeV3ConflictError,
	KnowledgeV3ValidationError,
	_empty_payload,
	_etag,
	_expect_etag,
	_validate_payload_identity,
	_validate_publishable_payload,
)


def _bundle():
	return SimpleNamespace(
		name="acesso-ava",
		bundle_key="acesso-ava",
		theme_key="acesso-ava",
		title="Acesso ao AVA",
		audience_profile="mixed",
	)


def _version(revision=3):
	return SimpleNamespace(version_id="version-123", revision=revision)


def _valid_payload():
	return {
		"schema_version": "3.0.0",
		"bundle_key": "acesso-ava",
		"theme_key": "acesso-ava",
		"metadata": {"title": "Acesso ao AVA", "audience_profile": "mixed"},
		"graph": {
			"student_root_node_id": "root",
			"public_root_node_id": "public-root",
			"internal_root_node_id": None,
		},
		"routing_policy": {"pattern_key": "op_then_area"},
		"nodes": [
			{
				"node_id": "root",
				"stable_key": "root",
				"node_kind": "path",
				"audiences": ["student"],
				"content": {"student": {"blocks": []}, "public": None},
				"playbooks": {"op": None, "bpo": None, "analyst": None},
			},
			{
				"node_id": "final",
				"stable_key": "final",
				"node_kind": "final",
				"audiences": ["student"],
				"content": {"student": {"blocks": [], "outcome_key": "resolved"}, "public": None},
				"playbooks": {"op": {"objective": "Resolver"}, "bpo": None, "analyst": None},
			},
			{
				"node_id": "public-root",
				"stable_key": "public-root",
				"node_kind": "final",
				"audiences": ["public"],
				"content": {"student": None, "public": {"blocks": [], "outcome_key": "resolved"}},
				"playbooks": {"op": None, "bpo": None, "analyst": None},
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


class TestKnowledgeV3Contracts(TestCase):
	def test_etag_is_version_and_revision(self):
		self.assertEqual(_etag(_version()), '"version-123-3"')

	@patch("univesp_atendimento.api.v1.knowledge_v3.frappe.get_request_header", return_value="")
	def test_if_match_is_required_and_detects_conflict(self, _header):
		with self.assertRaises(KnowledgeV3ConflictError):
			_expect_etag(_version(), "")
		with self.assertRaises(KnowledgeV3ConflictError):
			_expect_etag(_version(), '"version-123-2"')
		_expect_etag(_version(), '"version-123-3"')

	def test_empty_payload_keeps_bundle_identity(self):
		payload = _empty_payload(_bundle())
		self.assertEqual(payload["schema_version"], "3.0.0")
		self.assertEqual(payload["bundle_key"], "acesso-ava")
		self.assertEqual(payload["theme_key"], "acesso-ava")
		json.dumps(payload)

	def test_rejects_payload_from_another_bundle(self):
		payload = _valid_payload()
		payload["bundle_key"] = "outro"
		with self.assertRaises(KnowledgeV3ValidationError):
			_validate_payload_identity(payload, _bundle())

	@patch(
		"univesp_atendimento.api.v1.knowledge_v3.frappe.db.get_value",
		return_value=SimpleNamespace(
			name="op_then_area",
			steps_json='["op", "area"]',
			allowed_routing_keys_json='["atendimento-geral"]',
		),
	)
	def test_publishable_payload_requires_stable_unique_nodes(self, _get_value):
		_validate_publishable_payload(_valid_payload(), _bundle())
		payload = _valid_payload()
		payload["nodes"][1]["stable_key"] = "root"
		with self.assertRaises(KnowledgeV3ValidationError):
			_validate_publishable_payload(payload, _bundle())


class TestKnowledgeV3Lifecycle(IntegrationTestCase):
	def setUp(self):
		suffix = uuid.uuid4().hex[:8]
		self.bundle_key = f"faq-test-{suffix}"
		self.theme_key = self.bundle_key
		frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Theme Governance",
				"theme_key": self.theme_key,
				"theme_label": "Tema de teste",
				"owner_email": "owner.tests@univesp.br",
				"approver_group": f"approvers-{suffix}",
				"editor_areas": [
					{
						"area_key": "sra",
						"area_label": "SRA",
						"can_edit_draft": 1,
					}
				],
				"active": 1,
			}
		).insert(ignore_permissions=True, ignore_links=True)
		if not frappe.db.exists("Univesp Knowledge Routing Pattern", "op_then_area"):
			frappe.get_doc(
				{
					"doctype": "Univesp Knowledge Routing Pattern",
					"pattern_key": "op_then_area",
					"label": "OP para área",
					"bpo_enabled": 0,
					"steps_json": '["op","area"]',
					"allowed_routing_keys_json": '["atendimento-geral"]',
					"institutional_exceptions_json": "[]",
					"active": 1,
				}
			).insert(ignore_permissions=True)

	def context(self, email, profile, actions):
		return RequestContext(
			email=email,
			name=email,
			ra="",
			profile_key=profile,
			scopes={"areas": ["sra"], "knowledge_themes": [self.theme_key]},
			actions=frozenset(actions),
			request_id=f"request-{profile}",
			actor_email=email,
		)

	def payload(self):
		value = _valid_payload()
		value["bundle_key"] = self.bundle_key
		value["theme_key"] = self.theme_key
		return value

	def test_crud_etag_lifecycle_and_rollback(self):
		author = self.context(
			"author.tests@univesp.br",
			"analista_area",
			{"edit_knowledge_draft", "submit_knowledge_approval"},
		)
		approver = self.context(
			"approver.tests@univesp.br",
			"gestor_area",
			{"approve_knowledge"},
		)
		publisher = self.context(
			"publisher.tests@univesp.br",
			"admin_central",
			{"publish_knowledge_version", "rollback_knowledge_version"},
		)
		with patch.object(knowledge_v3, "_write_context", return_value=author):
			created = knowledge_v3.create_bundle(
				{
					"bundle_key": self.bundle_key,
					"title": "Fluxo de teste",
					"theme_key": self.theme_key,
					"audience_profile": "mixed",
					"payload": self.payload(),
				}
			)["data"]
			etag = created["draft"]["etag"]
			with self.assertRaises(KnowledgeV3ConflictError):
				knowledge_v3.save_draft(
					self.bundle_key,
					{"payload": self.payload(), "if_match": '"stale-1"'},
				)
			saved = knowledge_v3.save_draft(
				self.bundle_key,
				{"payload": self.payload(), "if_match": etag},
			)["data"]
			submitted = knowledge_v3.submit_for_approval(
				self.bundle_key,
				{
					"if_match": saved["etag"],
					"change_summary": "Alteração completa para teste automatizado.",
				},
			)["data"]
		self.assertEqual(submitted["lifecycle_state"], "pending_approval")

		with (
			patch.object(knowledge_v3, "_write_context", return_value=approver),
			patch.object(knowledge_v3, "_ensure_theme_approver"),
		):
			approved = knowledge_v3.approve(self.bundle_key)["data"]
		self.assertEqual(approved["lifecycle_state"], "approved")

		with patch.object(knowledge_v3, "_write_context", return_value=publisher):
			published = knowledge_v3.publish(approved["version_id"])["data"]
		self.assertEqual(published["lifecycle_state"], "published")

		with patch.object(knowledge_v3, "_write_context", return_value=author):
			forked = knowledge_v3.fork_draft(self.bundle_key)["data"]
			submitted = knowledge_v3.submit_for_approval(
				self.bundle_key,
				{
					"if_match": forked["etag"],
					"change_summary": "Segunda alteração completa para teste.",
				},
			)["data"]
		with (
			patch.object(knowledge_v3, "_write_context", return_value=approver),
			patch.object(knowledge_v3, "_ensure_theme_approver"),
		):
			second = knowledge_v3.approve(self.bundle_key)["data"]
		with patch.object(knowledge_v3, "_write_context", return_value=publisher):
			knowledge_v3.publish(second["version_id"])
			rolled_back = knowledge_v3.rollback(
				published["version_id"],
				{"reason": "Rollback automatizado do teste."},
			)["data"]
		self.assertEqual(rolled_back["version_id"], published["version_id"])
		self.assertEqual(rolled_back["lifecycle_state"], "published")

		with patch.object(knowledge_v3, "_write_context", return_value=author):
			third_fork = knowledge_v3.fork_draft(self.bundle_key)["data"]
			knowledge_v3.submit_for_approval(
				self.bundle_key,
				{
					"if_match": third_fork["etag"],
					"change_summary": "Terceira alteração para validar break-glass.",
				},
			)
		with (
			patch.object(knowledge_v3, "_write_context", return_value=publisher),
			patch.object(knowledge_v3, "_ensure_theme_approver"),
		):
			third = knowledge_v3.approve(self.bundle_key)["data"]
			confirmation = knowledge_v3.request_break_glass(third["version_id"])["data"]
		second_admin = self.context(
			"second.admin.tests@univesp.br",
			"admin_central",
			{"publish_knowledge_version"},
		)
		with patch.object(knowledge_v3, "_write_context", return_value=second_admin):
			knowledge_v3.confirm_break_glass(confirmation["confirmation_id"])
		with patch.object(knowledge_v3, "_write_context", return_value=publisher):
			break_glass_publish = knowledge_v3.publish(
				third["version_id"],
				{"confirmation_id": confirmation["confirmation_id"]},
			)["data"]
		self.assertEqual(break_glass_publish["lifecycle_state"], "published")
