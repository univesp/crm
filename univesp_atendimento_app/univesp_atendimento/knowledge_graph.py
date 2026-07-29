from univesp_atendimento.knowledge_blocks import validate_blocks


ALLOWED_AUDIENCES = {"student", "public", "internal"}
PROFILE_AUDIENCES = {
	"student": {"student"},
	"public": {"public"},
	"mixed": {"student", "public"},
	"internal": {"internal"},
}


class KnowledgeGraphError(ValueError):
	def __init__(self, code, message):
		super().__init__(message)
		self.code = code


def validate_knowledge_graph(payload):
	errors = []
	nodes = payload.get("nodes") if isinstance(payload, dict) else None
	edges = payload.get("edges") if isinstance(payload, dict) else None
	graph = payload.get("graph") if isinstance(payload, dict) else None
	if not isinstance(nodes, list) or not nodes:
		return [KnowledgeGraphError("NODES_REQUIRED", "O fluxo deve possuir nós.")]
	if not isinstance(edges, list):
		return [KnowledgeGraphError("EDGES_REQUIRED", "O fluxo deve possuir conexões.")]
	if not isinstance(graph, dict):
		return [KnowledgeGraphError("GRAPH_REQUIRED", "A configuração de raízes é obrigatória.")]

	node_by_id = {}
	for node in nodes:
		node_id = str(node.get("node_id") or "").strip() if isinstance(node, dict) else ""
		if not node_id or node_id in node_by_id:
			errors.append(KnowledgeGraphError("NODE_ID_INVALID", "IDs de nós devem ser únicos."))
			continue
		audiences = _audiences(node.get("audiences"))
		if not audiences:
			errors.append(
				KnowledgeGraphError("NODE_AUDIENCE_REQUIRED", f"Nó {node_id} não possui público válido.")
			)
		node_by_id[node_id] = node
		if node.get("node_kind") not in {"path", "final"}:
			errors.append(KnowledgeGraphError("NODE_KIND_INVALID", f"Tipo do nó {node_id} é inválido."))
		if node.get("node_kind") != "final" and node.get("document_policy") not in (None, {}):
			errors.append(
				KnowledgeGraphError(
					"DOCUMENT_POLICY_NON_FINAL",
					f"Política documental só pode existir em nó final: {node_id}.",
				)
			)
		if node.get("node_kind") != "final" and node.get("intake_policy") not in (None, {}):
			errors.append(
				KnowledgeGraphError(
					"INTAKE_POLICY_ONLY_FINAL",
					f"Política de identificação só pode existir em nó final: {node_id}.",
				)
			)
		for layer in ("student", "public"):
			content = (node.get("content") or {}).get(layer)
			if isinstance(content, dict):
				for message in validate_blocks(content.get("blocks")):
					errors.append(KnowledgeGraphError("INVALID_CONTENT_BLOCK", f"{node_id}: {message}"))

	edge_ids = set()
	for edge in edges:
		if not isinstance(edge, dict):
			errors.append(KnowledgeGraphError("EDGE_INVALID", "Conexão inválida."))
			continue
		edge_id = str(edge.get("edge_id") or "").strip()
		if not edge_id or edge_id in edge_ids:
			errors.append(KnowledgeGraphError("EDGE_ID_INVALID", "IDs de conexões devem ser únicos."))
		edge_ids.add(edge_id)
		parent = node_by_id.get(str(edge.get("parent_node_id") or "").strip())
		child = node_by_id.get(str(edge.get("child_node_id") or "").strip())
		if not parent or not child:
			errors.append(
				KnowledgeGraphError("EDGE_NODE_MISSING", f"Conexão {edge_id} referencia nó inexistente.")
			)
			continue
		edge_audiences = _audiences(edge.get("audiences"))
		if not edge_audiences:
			errors.append(
				KnowledgeGraphError("EDGE_AUDIENCE_REQUIRED", f"Conexão {edge_id} não possui público.")
			)
		if not edge_audiences.issubset(_audiences(parent.get("audiences"))):
			errors.append(
				KnowledgeGraphError(
					"EDGE_PARENT_AUDIENCE",
					f"Público da conexão {edge_id} não existe no nó pai.",
				)
			)
		if not edge_audiences.issubset(_audiences(child.get("audiences"))):
			errors.append(
				KnowledgeGraphError(
					"EDGE_CHILD_AUDIENCE",
					f"Público da conexão {edge_id} não existe no nó filho.",
				)
			)

	profile = str((payload.get("metadata") or {}).get("audience_profile") or "").strip()
	required_audiences = PROFILE_AUDIENCES.get(profile, set())
	if not required_audiences:
		errors.append(KnowledgeGraphError("AUDIENCE_PROFILE_INVALID", "Perfil de público inválido."))
	for audience in ALLOWED_AUDIENCES:
		root_id = str(graph.get(f"{audience}_root_node_id") or "").strip()
		if audience in required_audiences and not root_id:
			errors.append(KnowledgeGraphError("ROOT_REQUIRED", f"Raiz obrigatória ausente para {audience}."))
			continue
		if not root_id:
			continue
		errors.extend(_validate_audience_tree(node_by_id, edges, audience, root_id))
	return errors


def assert_valid_knowledge_graph(payload):
	errors = validate_knowledge_graph(payload)
	if errors:
		raise errors[0]


def validate_ordered_path(payload, audience, path):
	audience = str(audience or "").strip()
	if audience not in ALLOWED_AUDIENCES:
		raise KnowledgeGraphError("AUDIENCE_INVALID", "Público da sessão inválido.")
	normalized_path = [str(item or "").strip() for item in path or [] if str(item or "").strip()]
	graph = payload.get("graph") if isinstance(payload, dict) else {}
	root_id = str((graph or {}).get(f"{audience}_root_node_id") or "").strip()
	if not normalized_path or normalized_path[0] != root_id:
		raise KnowledgeGraphError("PATH_ROOT_INVALID", "O caminho deve começar na raiz publicada.")
	nodes = {
		str(node.get("node_id") or "").strip(): node
		for node in payload.get("nodes") or []
		if isinstance(node, dict)
	}
	for node_id in normalized_path:
		node = nodes.get(node_id)
		if not node or audience not in _audiences(node.get("audiences")):
			raise KnowledgeGraphError("PATH_NODE_INVALID", "O caminho contém nó indisponível.")
	active_pairs = {
		(str(edge.get("parent_node_id") or "").strip(), str(edge.get("child_node_id") or "").strip())
		for edge in payload.get("edges") or []
		if isinstance(edge, dict)
		and edge.get("active") is not False
		and audience in _audiences(edge.get("audiences"))
	}
	for parent_id, child_id in zip(normalized_path, normalized_path[1:]):
		if (parent_id, child_id) not in active_pairs:
			raise KnowledgeGraphError("PATH_DISCONTINUOUS", "O caminho não segue conexões publicadas.")
	return normalized_path


def project_runtime(payload, persona):
	persona = str(persona or "").strip()
	audience = "public" if persona == "public" else "internal" if persona == "analyst" else "student"
	graph = payload.get("graph") or {}
	if audience == "internal" and not graph.get("internal_root_node_id"):
		audience = "student"
	assert_valid_knowledge_graph(payload)
	node_by_id = {
		str(node.get("node_id") or "").strip(): node
		for node in payload.get("nodes") or []
		if isinstance(node, dict) and audience in _audiences(node.get("audiences"))
	}
	root_id = str(graph.get(f"{audience}_root_node_id") or "").strip()
	projected_nodes = []
	for node_id, node in node_by_id.items():
		content_layer = None
		if audience in {"student", "public"}:
			content_layer = (node.get("content") or {}).get(audience)
		playbook = _effective_playbook(node.get("playbooks") or {}, persona)
		projected_nodes.append(
			{
				"node_id": node_id,
				"stable_key": str(node.get("stable_key") or ""),
				"node_kind": node.get("node_kind"),
				"display": dict(node.get("display") or {}),
				"content": content_layer,
				"playbook": playbook,
				"document_policy": node.get("document_policy") if audience == "public" else None,
				"intake_policy": node.get("intake_policy") if audience == "public" else None,
			}
		)
	projected_edges = [
		{
			"edge_id": str(edge.get("edge_id") or ""),
			"parent_node_id": str(edge.get("parent_node_id") or ""),
			"child_node_id": str(edge.get("child_node_id") or ""),
			"order": int(edge.get("order") or 0),
			"label": str(edge.get("label") or ""),
		}
		for edge in payload.get("edges") or []
		if isinstance(edge, dict)
		and edge.get("active") is not False
		and audience in _audiences(edge.get("audiences"))
		and edge.get("parent_node_id") in node_by_id
		and edge.get("child_node_id") in node_by_id
	]
	return {
		"schema_version": "3.0.0",
		"bundle_key": payload.get("bundle_key"),
		"theme_key": payload.get("theme_key"),
		"persona": persona,
		"graph_audience": audience,
		"root_node_id": root_id,
		"metadata": _public_metadata(payload.get("metadata") or {}, persona),
		"nodes": projected_nodes,
		"edges": projected_edges,
	}


def _validate_audience_tree(node_by_id, edges, audience, root_id):
	errors = []
	visible = {
		node_id: node for node_id, node in node_by_id.items() if audience in _audiences(node.get("audiences"))
	}
	if root_id not in visible:
		return [
			KnowledgeGraphError(
				"ROOT_INVALID",
				f"Raiz {root_id or '(vazia)'} não está visível para {audience}.",
			)
		]
	if audience in {"student", "public"}:
		for node_id, node in visible.items():
			if not isinstance((node.get("content") or {}).get(audience), dict):
				errors.append(
					KnowledgeGraphError(
						"CONTENT_LAYER_REQUIRED",
						f"Nó {node_id} não possui conteúdo navegável para {audience}.",
					)
				)
	active_edges = [
		edge
		for edge in edges
		if isinstance(edge, dict)
		and edge.get("active") is not False
		and audience in _audiences(edge.get("audiences"))
		and edge.get("parent_node_id") in visible
		and edge.get("child_node_id") in visible
	]
	inbound = {node_id: 0 for node_id in visible}
	adjacency = {node_id: [] for node_id in visible}
	for edge in active_edges:
		parent = edge["parent_node_id"]
		child = edge["child_node_id"]
		inbound[child] += 1
		adjacency[parent].append(child)
	if inbound[root_id] != 0:
		errors.append(KnowledgeGraphError("ROOT_HAS_PARENT", f"Raiz de {audience} possui pai."))
	for node_id, total in inbound.items():
		if node_id != root_id and total != 1:
			errors.append(
				KnowledgeGraphError(
					"TREE_PARENT_COUNT",
					f"Nó {node_id} deve ter exatamente um pai em {audience}.",
				)
			)
	visited = set()
	active = set()

	def visit(node_id):
		if node_id in active:
			errors.append(KnowledgeGraphError("CYCLE", f"Ciclo detectado em {node_id}."))
			return
		if node_id in visited:
			return
		active.add(node_id)
		for child_id in adjacency[node_id]:
			visit(child_id)
		active.remove(node_id)
		visited.add(node_id)

	visit(root_id)
	orphans = sorted(set(visible) - visited)
	if orphans:
		errors.append(
			KnowledgeGraphError("ORPHAN_NODES", f"Nós fora da árvore de {audience}: {', '.join(orphans)}.")
		)
	return errors


def _effective_playbook(playbooks, persona):
	if persona == "op":
		return playbooks.get("op")
	if persona == "bpo":
		return _merge_playbook(playbooks.get("op"), playbooks.get("bpo"))
	if persona == "analyst":
		return playbooks.get("analyst")
	return None


def _merge_playbook(base, override):
	if not isinstance(base, dict):
		base = {}
	if override is None:
		return dict(base) or None
	if not isinstance(override, dict):
		return dict(base) or None
	result = dict(base)
	for key, value in override.items():
		if value is not None:
			result[key] = value
	return result or None


def _public_metadata(metadata, persona):
	result = {
		"title": str(metadata.get("title") or ""),
		"audience_profile": str(metadata.get("audience_profile") or ""),
	}
	if persona in {"op", "bpo", "analyst"}:
		result.update(
			{
				"criticidade_default_key": metadata.get("criticidade_default_key"),
				"sla_policy_key": metadata.get("sla_policy_key"),
			}
		)
	return result


def _audiences(value):
	if not isinstance(value, list):
		return set()
	return {str(item).strip() for item in value if str(item).strip()} & ALLOWED_AUDIENCES
