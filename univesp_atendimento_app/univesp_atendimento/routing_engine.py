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

	def as_dict(self, *, public: bool = False) -> dict:
		data = {
			"pattern_key": self.pattern_key,
			"path_labels": list(self.path_labels),
			"applied_rules": list(self.applied_rules),
		}
		if not public:
			data["routing_key"] = self.routing_key
			data["resolved_queue"] = self.resolved_queue
			data["resolved_area"] = self.resolved_area
		return data


STEP_LABELS = {
	"op": "OP do polo",
	"bpo": "BPO regional",
	"triage": "Triagem Central",
	"area": "Área responsável",
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
		raise RoutingResolutionError("Padrão de roteamento incompleto.")

	node = _node(bundle_payload, node_id)
	theme_key = _text(context.get("theme_key") or bundle_payload.get("theme_key"))
	criticality = _text(
		context.get("criticidade")
		or (node.get("operational") or {}).get("criticidade")
		or (bundle_payload.get("metadata") or {}).get("criticidade_default_key")
		or (bundle_payload.get("metadata") or {}).get("default_criticidade")
	).lower()
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

	if theme_key.lower() in exceptions or criticality in exceptions:
		routing_key = _first_available(("sra", fallback_key), allowed, queue_exists)
		if not routing_key:
			raise RoutingResolutionError("Exceção institucional sem fila válida.")
		applied.append("institutional_exception")
	else:
		node_operational = node.get("operational") if isinstance(node.get("operational"), dict) else {}
		owner = (
			(bundle_payload.get("metadata") or {}).get("operational_owner")
			if isinstance(bundle_payload.get("metadata"), dict)
			else {}
		) or {}
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
			instance_candidates = _instance_candidates(steps, context)
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
		raise RoutingResolutionError("Nenhuma fila ativa satisfaz a política de roteamento.")

	owner = ((bundle_payload.get("metadata") or {}).get("operational_owner") or {})
	area = _text((node.get("operational") or {}).get("area_key"))
	if not area and owner.get("owner_type") == "area":
		area = _text(owner.get("owner_key"))
	return RoutingDecision(
		routing_key=routing_key,
		resolved_queue=routing_key,
		resolved_area=area,
		pattern_key=pattern_key,
		path_labels=tuple(STEP_LABELS.get(step, step) for step in steps),
		applied_rules=tuple(applied),
	)


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
	raise RoutingResolutionError("Nó não pertence à versão informada.")


def _text(value) -> str:
	return str(value or "").strip()
