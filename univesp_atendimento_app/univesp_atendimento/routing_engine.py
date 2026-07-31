from dataclasses import dataclass
from typing import Callable


class RoutingResolutionError(ValueError):
	pass


@dataclass(frozen=True)
class RoutingDecision:
	routing_key: str
	resolved_queue: str
	resolved_area: str
	pattern_key: str
	path_labels: tuple[str, ...]
	applied_rules: tuple[str, ...]
	criticidade: str = ""
	sla_policy_key: str = ""
	assignee_email: str = ""
	routing_chain: tuple[str, ...] = ()

	def as_dict(self, *, public: bool = False) -> dict:
		data = {
			"pattern_key": self.pattern_key,
			"path_labels": list(self.path_labels),
			"applied_rules": list(self.applied_rules),
			"criticidade": self.criticidade,
			"sla_policy_key": self.sla_policy_key,
			"routing_chain": list(self.routing_chain),
		}
		if not public:
			data["routing_key"] = self.routing_key
			data["resolved_queue"] = self.resolved_queue
			data["resolved_area"] = self.resolved_area
			data["assignee_email"] = self.assignee_email
		return data


STEP_LABELS = {
	"op": "OP do polo",
	"bpo": "BPO regional",
	"triage": "Triagem Central",
	"area": "Area responsavel",
}


def resolve_route(
	*,
	pattern: dict,
	bundle_payload: dict,
	node_id: str,
	context: dict,
	queue_exists: Callable[[str], bool],
	fallback_key: str = "atendimento-geral",
) -> RoutingDecision:
	pattern_key = _text(pattern.get("pattern_key"))
	steps = [_text(step) for step in pattern.get("steps") or [] if _text(step)]
	allowed = {_text(key) for key in pattern.get("allowed_routing_keys") or [] if _text(key)}
	if not pattern_key or not steps or not allowed:
		raise RoutingResolutionError("Padrao de roteamento incompleto.")

	node = _node(bundle_payload, node_id)
	node_operational = node.get("operational") if isinstance(node.get("operational"), dict) else {}
	metadata = bundle_payload.get("metadata") if isinstance(bundle_payload.get("metadata"), dict) else {}
	theme_key = _text(context.get("theme_key") or bundle_payload.get("theme_key"))
	criticidade = _text(
		context.get("criticidade")
		or node_operational.get("criticidade")
		or metadata.get("criticidade_default_key")
		or metadata.get("default_criticidade")
	).lower()
	sla_policy_key = _text(
		context.get("sla_policy_key")
		or node_operational.get("sla_policy_key")
		or metadata.get("sla_policy_key")
		or (bundle_payload.get("routing_policy") or {}).get("sla_policy_key")
	)
	assignee_email = _text(node_operational.get("assignee_email") or context.get("assignee_email")).lower()
	routing_chain = _routing_chain(node_operational.get("routing_chain"))
	effective_steps = routing_chain or steps
	exceptions = {
		_text(item).lower()
		for item in (
			(bundle_payload.get("routing_policy") or {}).get("institutional_exceptions")
			or pattern.get("institutional_exceptions")
			or []
		)
		if _text(item)
	}
	applied = []

	if theme_key.lower() in exceptions or criticidade in exceptions:
		routing_key = _first_available(("sra", fallback_key), allowed, queue_exists)
		if not routing_key:
			raise RoutingResolutionError("Excecao institucional sem fila valida.")
		applied.append("institutional_exception")
	else:
		owner = (
			metadata.get("operational_owner") if isinstance(metadata.get("operational_owner"), dict) else {}
		)
		policy = bundle_payload.get("routing_policy") or {}
		policy_candidates = (
			node_operational.get("routing_override"),
			node_operational.get("routing_key"),
			policy.get("default_routing_key"),
		)
		routing_key = _first_available(policy_candidates, allowed, queue_exists)
		if routing_key:
			applied.append("node_or_bundle_policy")

		if not routing_key:
			instance_candidates = _instance_candidates(effective_steps, context)
			routing_key = _first_available(instance_candidates, allowed, queue_exists)
			if routing_key:
				applied.append("polo_or_region")

		if not routing_key and _text(owner.get("owner_type")) == "queue":
			routing_key = _first_available((owner.get("owner_key"),), allowed, queue_exists)
			if routing_key:
				applied.append("operational_owner")

		if not routing_key:
			routing_key = _first_available((fallback_key,), allowed, queue_exists)
			if routing_key:
				applied.append("institutional_fallback")

	if not routing_key:
		raise RoutingResolutionError("Nenhuma fila ativa satisfaz a politica de roteamento.")

	owner = metadata.get("operational_owner") or {}
	area = _text(node_operational.get("area_key"))
	if not area and owner.get("owner_type") == "area":
		area = _text(owner.get("owner_key"))

	return RoutingDecision(
		routing_key=routing_key,
		resolved_queue=routing_key,
		resolved_area=area,
		pattern_key=pattern_key,
		path_labels=tuple(STEP_LABELS.get(step, step) for step in effective_steps),
		applied_rules=tuple(applied),
		criticidade=criticidade,
		sla_policy_key=sla_policy_key,
		assignee_email=assignee_email,
		routing_chain=routing_chain or tuple(steps),
	)


def validate_final_node_operational(
	node: dict,
	bundle_payload: dict,
	*,
	pattern_steps: list[str] | None = None,
) -> None:
	if str(node.get("node_kind") or "").strip() != "final":
		return
	node_operational = node.get("operational") if isinstance(node.get("operational"), dict) else {}
	metadata = bundle_payload.get("metadata") if isinstance(bundle_payload.get("metadata"), dict) else {}
	routing_chain = _routing_chain(node_operational.get("routing_chain"))
	default_steps = [_text(step) for step in (pattern_steps or []) if _text(step)]
	if not default_steps:
		policy = (
			bundle_payload.get("routing_policy")
			if isinstance(bundle_payload.get("routing_policy"), dict)
			else {}
		)
		default_steps = [_text(step) for step in (policy.get("steps") or []) if _text(step)]
	effective_steps = routing_chain or default_steps
	if "area" not in effective_steps:
		return
	area = _text(node_operational.get("area_key"))
	owner = metadata.get("operational_owner") if isinstance(metadata.get("operational_owner"), dict) else {}
	if not area and owner.get("owner_type") == "area":
		area = _text(owner.get("owner_key"))
	if not area:
		raise RoutingResolutionError("Resposta final sem area responsavel definida.")


def _instance_candidates(steps: list[str], context: dict) -> tuple[str, ...]:
	polo = _text(context.get("polo_key"))
	region = _text(context.get("region_key") or context.get("regional_pool_key"))
	candidates = []
	for step in steps:
		if step == "bpo" and region:
			candidates.extend((f"bpo-{region}", region))
		if step == "op" and polo:
			candidates.extend((f"op-{polo}", polo))
	return tuple(candidates)


def _routing_chain(value) -> tuple[str, ...]:
	if not isinstance(value, list):
		return ()
	normalized = tuple(_text(step) for step in value if _text(step))
	return normalized


def _first_available(candidates, allowed: set[str], queue_exists: Callable[[str], bool]) -> str:
	for candidate in candidates:
		key = _text(candidate)
		if key and key in allowed and queue_exists(key):
			return key
	return ""


def _node(payload: dict, node_id: str) -> dict:
	normalized = _text(node_id)
	for node in payload.get("nodes") or []:
		if isinstance(node, dict) and _text(node.get("node_id")) == normalized:
			return node
	raise RoutingResolutionError("No nao pertence a versao informada.")


def _text(value) -> str:
	return str(value or "").strip()
