/** Adaptador de produto ↔ payload knowledge v3 (árvore única, canais). */

export const PUBLIC_CONTENT_INHERIT = 'inherit_student'
export const PUBLIC_CONTENT_CUSTOM = 'custom'

function clonePayload(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Converte flags de canal em audience_profile persistido.
 * @param {{ availableStudent?: boolean, availablePublic?: boolean }} flags
 */
export function audienceProfileFromChannels(flags = {}) {
  const student = Boolean(flags.availableStudent)
  const pub = Boolean(flags.availablePublic)
  if (student && pub) return 'mixed'
  if (pub) return 'public'
  return 'student'
}

/**
 * Lê canais a partir do payload/bundle.
 * @param {object|null} payload
 * @param {string} [fallbackProfile]
 */
export function channelsFromPayload(payload, fallbackProfile = 'student') {
  const profile =
    String(payload?.metadata?.audience_profile || fallbackProfile || 'student').trim() ||
    'student'
  return {
    availableStudent: profile === 'student' || profile === 'mixed',
    availablePublic: profile === 'public' || profile === 'mixed',
  }
}

export function channelAudiences(flags) {
  const audiences = []
  if (flags.availableStudent) audiences.push('student')
  if (flags.availablePublic) audiences.push('public')
  return audiences.length ? audiences : ['student']
}

export function canonicalRootId(payload) {
  const graph = payload?.graph || {}
  return (
    String(graph.student_root_node_id || '').trim() ||
    String(graph.public_root_node_id || '').trim() ||
    String(graph.internal_root_node_id || '').trim() ||
    String(payload?.nodes?.[0]?.node_id || '').trim() ||
    ''
  )
}

/**
 * Detecta payload legado com árvores distintas por público.
 */
export function isLegacyDualTree(payload) {
  if (!payload || typeof payload !== 'object') return false
  const studentRoot = String(payload.graph?.student_root_node_id || '').trim()
  const publicRoot = String(payload.graph?.public_root_node_id || '').trim()
  if (studentRoot && publicRoot && studentRoot !== publicRoot) return true
  const hasPresentation = (payload.nodes || []).some(
    (node) => node?.presentation?.public_content_mode,
  )
  return Boolean(payload._legacy_dual_tree) && !hasPresentation
}

export function publicContentMode(node) {
  const mode = String(node?.presentation?.public_content_mode || '').trim()
  if (mode === PUBLIC_CONTENT_CUSTOM || mode === PUBLIC_CONTENT_INHERIT) return mode
  return ''
}

export function inheritsPublicFromStudent(node) {
  const mode = publicContentMode(node)
  if (mode === PUBLIC_CONTENT_CUSTOM) return false
  if (mode === PUBLIC_CONTENT_INHERIT) return true
  return false
}

export function resolveNodeContent(node, channel) {
  if (channel === 'public' && inheritsPublicFromStudent(node)) {
    return node?.content?.student || null
  }
  return node?.content?.[channel] || null
}

/**
 * Normaliza payload para o modelo de árvore única / canais.
 * Não funde silenciosamente raízes distintas — marca legado.
 */
export function normalizePayloadForEditor(payload, channelFlags) {
  if (!payload || typeof payload !== 'object') return payload
  const next = clonePayload(payload)
  const legacy = isLegacyDualTree(next)
  if (legacy) {
    next._legacy_dual_tree = true
    return next
  }

  const flags = channelFlags || channelsFromPayload(next)
  const audiences = channelAudiences(flags)
  const profile = audienceProfileFromChannels(flags)
  const rootId = canonicalRootId(next)

  next.metadata = { ...(next.metadata || {}), audience_profile: profile }
  next.graph = {
    student_root_node_id: flags.availableStudent ? rootId || null : null,
    public_root_node_id: flags.availablePublic ? rootId || null : null,
    internal_root_node_id: next.graph?.internal_root_node_id || null,
  }

  for (const node of next.nodes || []) {
    node.audiences = [...audiences]
    node.presentation = {
      ...(node.presentation || {}),
      public_content_mode:
        publicContentMode(node) ||
        (flags.availablePublic ? PUBLIC_CONTENT_INHERIT : PUBLIC_CONTENT_INHERIT),
    }
    node.content = node.content || {}
    if (flags.availableStudent && !node.content.student) {
      node.content.student = { blocks: [], outcome_key: '' }
    }
    if (!flags.availableStudent) {
      node.content.student = node.content.student ?? null
    }
    if (flags.availablePublic) {
      if (inheritsPublicFromStudent(node)) {
        node.content.public = null
      } else if (!node.content.public) {
        node.content.public = { blocks: [], outcome_key: '' }
      }
    } else {
      node.content.public = null
    }
  }

  for (const edge of next.edges || []) {
    edge.audiences = [...audiences]
  }

  delete next._legacy_dual_tree
  return next
}

/**
 * Aplica canais ao payload antes de salvar (derivação automática).
 */
export function applyChannelsToPayload(payload, channelFlags) {
  return normalizePayloadForEditor(payload, channelFlags)
}

/**
 * Define modo de conteúdo público em um nó.
 */
export function setPublicContentMode(node, mode) {
  if (!node) return
  node.presentation = {
    ...(node.presentation || {}),
    public_content_mode: mode === PUBLIC_CONTENT_CUSTOM ? PUBLIC_CONTENT_CUSTOM : PUBLIC_CONTENT_INHERIT,
  }
  node.content = node.content || {}
  if (mode === PUBLIC_CONTENT_CUSTOM) {
    if (!node.content.public) {
      node.content.public = clonePayload(node.content.student || { blocks: [], outcome_key: '' })
    }
  } else {
    node.content.public = null
  }
}

/**
 * Payload inicial de fluxo único.
 */
export function buildInitialUnifiedPayload({
  bundleKey,
  themeKey,
  title,
  availableStudent = true,
  availablePublic = false,
  patternKey = 'op_then_area',
}) {
  const flags = { availableStudent, availablePublic }
  const audiences = channelAudiences(flags)
  const profile = audienceProfileFromChannels(flags)
  const rootId = `${bundleKey}-inicio`
  const payload = {
    schema_version: '3.0.0',
    bundle_key: bundleKey,
    theme_key: themeKey,
    metadata: {
      title,
      audience_profile: profile,
      operational_owner: {
        owner_type: 'queue',
        owner_key: 'atendimento-geral',
      },
      criticidade_default_key: 'media',
      sla_policy_key: '48h',
    },
    graph: {
      student_root_node_id: flags.availableStudent ? rootId : null,
      public_root_node_id: flags.availablePublic ? rootId : null,
      internal_root_node_id: null,
    },
    routing_policy: {
      pattern_key: patternKey,
      bpo_enabled: String(patternKey).includes('bpo'),
      institutional_exceptions: ['provas', 'critica'],
    },
    nodes: [
      {
        node_id: rootId,
        stable_key: rootId,
        node_kind: 'path',
        audiences: [...audiences],
        display: { title: 'Início' },
        presentation: { public_content_mode: PUBLIC_CONTENT_INHERIT },
        content: {
          student: flags.availableStudent ? { blocks: [], outcome_key: '' } : null,
          public: null,
        },
        playbooks: { op: null, bpo: null, analyst: null },
        operational: {
          routing_override: null,
          criticidade: null,
          sla_policy_key: null,
        },
        document_policy: null,
        media_refs: [],
      },
    ],
    edges: [],
  }
  return payload
}

export function flattenCanonicalTree(payload) {
  if (!payload) return []
  const rootId = canonicalRootId(payload)
  if (!rootId) return []
  const result = []
  const visit = (nodeId, depth) => {
    const node = (payload.nodes || []).find((item) => item.node_id === nodeId)
    if (!node) return
    result.push({ ...node, depth })
    childEdgesOf(payload, nodeId).forEach((edge) => visit(edge.child_node_id, depth + 1))
  }
  visit(rootId, 0)
  return result
}

export function childEdgesOf(payload, nodeId) {
  return (payload?.edges || [])
    .filter((edge) => edge.active !== false && edge.parent_node_id === nodeId)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
}

export function availableChannelLabels(flags) {
  const labels = []
  if (flags.availableStudent) labels.push('Portal do Aluno')
  if (flags.availablePublic) labels.push('Atendimento público')
  return labels
}
