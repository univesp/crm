import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_datetime


MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
IMMUTABLE_STATES = {"approved", "published", "superseded", "rejected"}
ACTIVE_DRAFT_STATES = {"draft", "pending_approval"}
LIFECYCLE_STATES = ACTIVE_DRAFT_STATES | IMMUTABLE_STATES
ALLOWED_TRANSITIONS = {
	"draft": {"pending_approval"},
	"pending_approval": {"draft", "approved", "rejected"},
	"approved": {"published"},
	"published": {"superseded"},
	"superseded": {"published"},
	"rejected": set(),
}


class UnivespKnowledgeVersion(Document):
	def validate(self):
		self.version_id = str(self.version_id or "").strip()
		self.author_email = str(self.author_email or "").strip().lower()
		self.timezone = str(self.timezone or "America/Sao_Paulo").strip()
		if self.lifecycle_state not in LIFECYCLE_STATES:
			frappe.throw(_("Estado da versão inválido."), frappe.ValidationError)
		if int(self.revision or 0) < 1:
			frappe.throw(_("Revisão deve ser maior que zero."), frappe.ValidationError)
		self._validate_payload()
		self._validate_period()
		self._validate_single_active_draft()
		self._validate_immutable_fields()

	def on_trash(self):
		if not getattr(self.flags, "allow_knowledge_draft_delete", False):
			frappe.throw(_("Versões de conhecimento não podem ser excluídas."), frappe.PermissionError)
		if self.lifecycle_state not in ACTIVE_DRAFT_STATES:
			frappe.throw(_("Somente rascunho nunca publicado pode ser removido."), frappe.PermissionError)

	def _validate_payload(self):
		try:
			payload = json.loads(self.payload_json or "")
		except (TypeError, json.JSONDecodeError) as exc:
			raise frappe.ValidationError(_("Conteúdo da versão deve ser JSON válido.")) from exc
		if not isinstance(payload, dict) or str(payload.get("schema_version") or "") != "3.0.0":
			frappe.throw(_("Conteúdo deve usar schema_version 3.0.0."), frappe.ValidationError)
		if len((self.payload_json or "").encode("utf-8")) > MAX_PAYLOAD_BYTES:
			frappe.throw(_("Conteúdo excede o limite de 2 MiB."), frappe.ValidationError)

	def _validate_period(self):
		if (
			self.valid_from
			and self.valid_until
			and get_datetime(self.valid_until) <= get_datetime(self.valid_from)
		):
			frappe.throw(_("Vigência final deve ser posterior à inicial."), frappe.ValidationError)

	def _validate_single_active_draft(self):
		if self.lifecycle_state not in ACTIVE_DRAFT_STATES or not self.bundle:
			return
		existing = frappe.get_all(
			"Univesp Knowledge Version",
			filters={
				"bundle": self.bundle,
				"lifecycle_state": ["in", list(ACTIVE_DRAFT_STATES)],
				"name": ["!=", self.name or ""],
			},
			pluck="name",
			limit=1,
		)
		if existing:
			frappe.throw(_("O fluxo já possui um rascunho ativo."), frappe.ValidationError)

	def _validate_immutable_fields(self):
		if self.is_new():
			return
		before = frappe.db.get_value(
			"Univesp Knowledge Version",
			self.name,
			[
				"payload_json",
				"author_email",
				"approver_email",
				"publisher_email",
				"approved_at",
				"published_at",
				"superseded_at",
				"rejection_reason",
				"change_summary",
				"valid_from",
				"valid_until",
				"timezone",
				"lifecycle_state",
			],
			as_dict=True,
		)
		if not before:
			return
		if before.author_email != self.author_email:
			frappe.throw(_("Autor da versão é imutável."), frappe.ValidationError)
		if before.lifecycle_state != self.lifecycle_state:
			if not getattr(self.flags, "knowledge_lifecycle_transition", False):
				frappe.throw(
					_("Transições de lifecycle devem usar a API institucional."),
					frappe.PermissionError,
				)
			if self.lifecycle_state not in ALLOWED_TRANSITIONS.get(before.lifecycle_state, set()):
				frappe.throw(_("Transição de lifecycle inválida."), frappe.ValidationError)
		if before.lifecycle_state in IMMUTABLE_STATES and before.payload_json != self.payload_json:
			frappe.throw(
				_("Conteúdo aprovado ou histórico é imutável. Crie nova versão."),
				frappe.ValidationError,
			)
		if before.lifecycle_state in IMMUTABLE_STATES:
			protected = ("approver_email", "change_summary", "valid_from", "valid_until", "timezone")
			if any(before.get(fieldname) != self.get(fieldname) for fieldname in protected):
				frappe.throw(_("Metadados da versão aprovada são imutáveis."), frappe.ValidationError)
			publisher_changed = before.publisher_email != self.publisher_email
			lifecycle_metadata_changed = publisher_changed or any(
				before.get(fieldname) != self.get(fieldname)
				for fieldname in ("approved_at", "published_at", "superseded_at", "rejection_reason")
			)
			if lifecycle_metadata_changed and not (
				getattr(self.flags, "knowledge_lifecycle_transition", False)
				or getattr(self.flags, "knowledge_schedule_publication", False)
			):
				frappe.throw(
					_("Metadados de lifecycle só podem ser alterados pela API."), frappe.PermissionError
				)
