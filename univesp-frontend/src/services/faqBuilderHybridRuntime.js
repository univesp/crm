import dagre from 'dagre'

import faqAluno from '../../mocks/faq-aluno.json'
import faqOp from '../../mocks/faq-op.json'
import {
  ACTION_CATALOG,
  CRITICALITY_CATALOG,
  FAQ_TYPE_CATALOG,
  QUEUE_DESTINATION_CATALOG,
  SLA_CATALOG,
  getCatalogKeys,
  hasCatalogValue,
} from '@/services/faqCatalogs'
import {
  buildOperationalOwnershipReferenceCatalog,
  hasOperationalOwnershipReference,
  normalizeOperationalOwnershipReferenceCatalog,
} from '@/services/operationalOwnershipReferences'
import { validateBundleOwnershipCoverageForServer } from '@/services/operationalOwnershipServerRuntime'

const FAQ_PACKAGE_MAP = {
  aluno: faqAluno,
  op: faqOp,
}

const WORKFLOW_STATUS_MAP = Object.freeze({
  draft: 'Draft',
  review: 'In Review',
  published: 'Published',
  archived: 'Archived',
})

const WORKFLOW_STATUS_REVERSE = Object.freeze({
  Draft: 'draft',
  'In Review': 'review',
  Published: 'published',
  Archived: 'archived',
})

const NODE_MODE_MAP = Object.freeze({
  path: 'path',
  final: 'final',
})

const OPERATIONAL_OWNER_TYPE = Object.freeze({
  queue: 'queue',
  area: 'area',
  role: 'role',
})

const OPERATIONAL_OWNER_INHERIT_TRUE_VALUES = new Set(['1', 'true', 'sim', 'yes', 'y'])
const OPERATIONAL_OWNER_INHERIT_FALSE_VALUES = new Set(['0', 'false', 'nao', 'não', 'no', 'n'])

const DEFAULT_NODE_WIDTH = 278
const DEFAULT_NODE_HEIGHT = 132
const FAQ_BUILDER_LOCAL_STORAGE_PREFIX = 'univesp:faq-builder:workspace'
const FAQ_BUILDER_LIBRARY_STORAGE_KEY = 'univesp:faq-builder:library:v1'
const FAQ_BUILDER_LIBRARY_MAX_SIZE_BYTES = 1_500_000
export const FAQ_BUILDER_RUNTIME_GUARDS = Object.freeze({
  maxRenderNodes: 450,
  maxRenderEdges: 900,
  maxValidationNodes: 1200,
  maxValidationEdges: 2400,
})
const DEFAULT_CANVAS_SNAPSHOT = Object.freeze({
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
})

const IMPORT_STATUS_MAP = Object.freeze({
  draft: 'draft',
  'in review': 'review',
  review: 'review',
  published: 'published',
  archived: 'archived',
})

const HEADER_ALIAS_MAP = Object.freeze({
  node_id: 'node_id',
  id_interno: 'node_id',
  id: 'node_id',
  short_title: 'short_title',
  titulo_curto: 'short_title',
  title: 'short_title',
  node_type: 'node_type',
  tipo_do_no: 'node_type',
  tipo_no: 'node_type',
  parent_id: 'parent_id',
  id_do_pai: 'parent_id',
  parent: 'parent_id',
  response_content: 'response_content',
  conteudo_da_resposta: 'response_content',
  resposta: 'response_content',
  closing_action: 'closing_action',
  acao_de_encerramento: 'closing_action',
  acao: 'closing_action',
  child_order: 'child_order',
  ordem_do_filho: 'child_order',
  ordem: 'child_order',
  theme: 'theme',
  tema: 'theme',
  subtheme: 'subtheme',
  subtema: 'subtheme',
  status: 'status',
  situacao: 'status',
  internal_note: 'internal_note',
  observacao_interna: 'internal_note',
  queue_destination: 'queue_destination',
  fila_destino: 'queue_destination',
  criticality: 'criticality',
  criticidade: 'criticality',
  sla: 'sla',
  slug: 'slug',
  tags: 'tags',
  owner_type: 'owner_type',
  tipo_responsavel: 'owner_type',
  owner_queue: 'owner_queue',
  fila_responsavel: 'owner_queue',
  owner_area: 'owner_area',
  area_responsavel: 'owner_area',
  owner_role: 'owner_role',
  perfil_responsavel: 'owner_role',
  owner_inherit: 'owner_inherit',
  herda_responsavel: 'owner_inherit',
  owner_routing_policy: 'owner_routing_policy',
  politica_roteamento: 'owner_routing_policy',
  owner_fallback_note: 'owner_fallback_note',
  observacao_operacional: 'owner_fallback_note',
  bundle_owner_type: 'bundle_owner_type',
  bundle_tipo_responsavel: 'bundle_owner_type',
  bundle_owner_queue: 'bundle_owner_queue',
  bundle_fila_responsavel: 'bundle_owner_queue',
  bundle_owner_area: 'bundle_owner_area',
  bundle_area_responsavel: 'bundle_owner_area',
  bundle_owner_role: 'bundle_owner_role',
  bundle_perfil_responsavel: 'bundle_owner_role',
  bundle_owner_routing_policy: 'bundle_owner_routing_policy',
  bundle_politica_roteamento: 'bundle_owner_routing_policy',
  bundle_owner_fallback_note: 'bundle_owner_fallback_note',
  bundle_observacao_operacional: 'bundle_owner_fallback_note',
})

let excelJsModulePromise = null

async function loadExcelJs() {
  if (!excelJsModulePromise) {
    excelJsModulePromise = import('exceljs')
  }

  const module = await excelJsModulePromise
  return module.default || module
}

function normalizeExcelCellValue(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  if ('text' in value) return value.text
  if ('result' in value) return value.result ?? ''
  if (Array.isArray(value.richText)) {
    return value.richText.map((entry) => entry.text || '').join('')
  }
  return String(value)
}

export const FAQ_BUILDER_WORKFLOW_OPTIONS = Object.freeze([
  'Draft',
  'In Review',
  'Published',
  'Archived',
])

export const FAQ_BUILDER_SPREADSHEET_COLUMNS = Object.freeze([
  { key: 'node_id', label: 'node_id', required: true, description: 'ID interno unico do no.' },
  { key: 'short_title', label: 'short_title', required: true, description: 'Titulo curto exibido no fluxo.' },
  { key: 'node_type', label: 'node_type', required: true, description: "Use 'path' ou 'final'." },
  { key: 'parent_id', label: 'parent_id', required: false, description: 'ID do pai. Deixe vazio para raiz.' },
  { key: 'response_content', label: 'response_content', required: false, description: 'Obrigatorio para node_type=final.' },
  { key: 'closing_action', label: 'closing_action', required: false, description: 'Acao final canonica.' },
  { key: 'child_order', label: 'child_order', required: false, description: 'Ordem do filho entre os irmaos.' },
  { key: 'theme', label: 'theme', required: true, description: 'Assunto principal.' },
  { key: 'subtheme', label: 'subtheme', required: true, description: 'Subassunto principal.' },
  { key: 'status', label: 'status', required: false, description: 'draft, review, published ou archived.' },
  { key: 'internal_note', label: 'internal_note', required: false, description: 'Observacao interna para governanca.' },
  { key: 'queue_destination', label: 'queue_destination', required: false, description: 'Destino padrao da fila.' },
  { key: 'criticality', label: 'criticality', required: false, description: 'baixa, media, alta, critica.' },
  { key: 'sla', label: 'sla', required: false, description: '4h, 8h, 24h, 48h ou 72h.' },
  { key: 'owner_inherit', label: 'owner_inherit', required: false, description: 'sim/nao para herdar responsavel operacional.' },
  { key: 'owner_type', label: 'owner_type', required: false, description: "queue, area ou role (quando owner_inherit='nao')." },
  { key: 'owner_area', label: 'owner_area', required: false, description: 'Area responsavel quando owner_type=area.' },
  { key: 'owner_queue', label: 'owner_queue', required: false, description: 'Fila responsavel quando owner_type=queue.' },
  { key: 'owner_role', label: 'owner_role', required: false, description: 'Perfil/role responsavel quando owner_type=role.' },
  { key: 'owner_routing_policy', label: 'owner_routing_policy', required: false, description: 'Politica de roteamento do no (opcional).' },
  { key: 'owner_fallback_note', label: 'owner_fallback_note', required: false, description: 'Observacao operacional do no (opcional).' },
  { key: 'bundle_owner_type', label: 'bundle_owner_type', required: false, description: 'Responsavel padrao do bundle: queue, area ou role.' },
  { key: 'bundle_owner_area', label: 'bundle_owner_area', required: false, description: 'Area responsavel padrao do bundle.' },
  { key: 'bundle_owner_queue', label: 'bundle_owner_queue', required: false, description: 'Fila responsavel padrao do bundle.' },
  { key: 'bundle_owner_role', label: 'bundle_owner_role', required: false, description: 'Role responsavel padrao do bundle.' },
  { key: 'bundle_owner_routing_policy', label: 'bundle_owner_routing_policy', required: false, description: 'Politica de roteamento padrao do bundle.' },
  { key: 'bundle_owner_fallback_note', label: 'bundle_owner_fallback_note', required: false, description: 'Observacao operacional padrao do bundle.' },
  { key: 'slug', label: 'slug', required: false, description: 'Chave opcional para busca e referencia.' },
  { key: 'tags', label: 'tags', required: false, description: 'Tags separadas por virgula.' },
])

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function readLocalStorageItem(key = '') {
  if (typeof window === 'undefined' || !key) {
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorageItem(key = '', value = '') {
  if (typeof window === 'undefined' || !key) {
    return false
  }

  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeLocalStorageItem(key = '') {
  if (typeof window === 'undefined' || !key) {
    return false
  }

  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function nowIso(currentDate = new Date()) {
  return currentDate.toISOString()
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function slugify(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCase(value = '') {
  const normalized = String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return ''
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function normalizeHeaderKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeNodeMode(rawValue = '') {
  const value = normalizeText(rawValue)

  if (['final', 'resposta', 'resposta_final', 'leaf'].includes(value)) {
    return NODE_MODE_MAP.final
  }

  if (['path', 'caminho', 'roteamento', 'branch', 'theme'].includes(value)) {
    return NODE_MODE_MAP.path
  }

  return ''
}

function normalizeWorkflowStatus(rawValue = '') {
  const value = normalizeText(rawValue)
  return IMPORT_STATUS_MAP[value] || 'draft'
}

function inferNodeMode(node = {}) {
  return node.node_kind === 'leaf' ? NODE_MODE_MAP.final : NODE_MODE_MAP.path
}

function normalizeNodeKindByMode(nodeMode = NODE_MODE_MAP.path, hasParent = true) {
  if (nodeMode === NODE_MODE_MAP.final) {
    return 'leaf'
  }

  return hasParent ? 'branch' : 'theme'
}

function buildCatalogOptions(catalog) {
  return getCatalogKeys(catalog).map((value) => ({
    value,
    label: catalog[value].label,
  }))
}

function sanitizeOwnershipBoolean(rawValue, fallback = true) {
  if (typeof rawValue === 'boolean') {
    return rawValue
  }

  const normalized = normalizeText(rawValue)
  if (!normalized) {
    return fallback
  }
  if (OPERATIONAL_OWNER_INHERIT_TRUE_VALUES.has(normalized)) {
    return true
  }
  if (OPERATIONAL_OWNER_INHERIT_FALSE_VALUES.has(normalized)) {
    return false
  }
  return fallback
}

function normalizeOwnershipType(rawType = '') {
  const normalized = normalizeText(rawType)
  if (
    normalized === OPERATIONAL_OWNER_TYPE.queue ||
    normalized === OPERATIONAL_OWNER_TYPE.area ||
    normalized === OPERATIONAL_OWNER_TYPE.role
  ) {
    return normalized
  }
  return OPERATIONAL_OWNER_TYPE.queue
}

function resolveDefaultQueueByFaqType(faqType = 'aluno') {
  return faqType === 'op' ? 'op' : 'sra'
}

function resolveOwnerKey(owner = {}) {
  const ownerType = normalizeOwnershipType(owner.ownerType || owner.owner_type)
  if (ownerType === OPERATIONAL_OWNER_TYPE.area) {
    return `area:${String(owner.areaLabel || owner.owner_area || '').trim()}`
  }
  if (ownerType === OPERATIONAL_OWNER_TYPE.role) {
    return `role:${String(owner.roleKey || owner.owner_role || '').trim()}`
  }
  return `queue:${String(owner.queueKey || owner.owner_queue || '').trim()}`
}

function normalizeOperationalOwner(rawOwner = {}, options = {}) {
  const fallbackQueue = options.fallbackQueue || resolveDefaultQueueByFaqType(options.faqType)
  const ownerType = normalizeOwnershipType(
    rawOwner.ownerType ||
      rawOwner.owner_type ||
      options.fallbackType ||
      OPERATIONAL_OWNER_TYPE.queue,
  )
  const queueKey = String(
    rawOwner.queueKey ||
      rawOwner.queue_key ||
      rawOwner.owner_queue ||
      rawOwner.queueDestination ||
      fallbackQueue ||
      '',
  ).trim()
  const areaLabel = String(
    rawOwner.areaLabel || rawOwner.area_label || rawOwner.owner_area || '',
  ).trim()
  const roleKey = String(rawOwner.roleKey || rawOwner.role_key || rawOwner.owner_role || '').trim()
  const queueLabel = hasCatalogValue(QUEUE_DESTINATION_CATALOG, queueKey)
    ? QUEUE_DESTINATION_CATALOG[queueKey].label
    : ''
  const normalizedOwner = {
    ownerType,
    queueKey,
    queueLabel,
    areaLabel,
    roleKey,
    routingPolicy: String(
      rawOwner.routingPolicy ||
        rawOwner.routing_policy ||
        rawOwner.owner_routing_policy ||
        '',
    ).trim(),
    fallbackNote: String(
      rawOwner.fallbackNote ||
        rawOwner.fallback_note ||
        rawOwner.owner_fallback_note ||
        '',
      ).trim(),
  }
  const providedOwnerKey = String(rawOwner.ownerKey || rawOwner.owner_key || '').trim()
  const expectedOwnerKeyPrefix = `${ownerType}:`
  const normalizedProvidedOwnerKey =
    providedOwnerKey && providedOwnerKey.startsWith(expectedOwnerKeyPrefix)
      ? providedOwnerKey
      : ''
  normalizedOwner.ownerKey = normalizedProvidedOwnerKey || resolveOwnerKey(normalizedOwner)
  return normalizedOwner
}

function hasOperationalOwnerValue(owner = {}) {
  const ownerType = normalizeOwnershipType(owner.ownerType || owner.owner_type)
  if (ownerType === OPERATIONAL_OWNER_TYPE.area) {
    return Boolean(String(owner.areaLabel || owner.owner_area || '').trim())
  }
  if (ownerType === OPERATIONAL_OWNER_TYPE.role) {
    return Boolean(String(owner.roleKey || owner.owner_role || '').trim())
  }
  const queueKey = String(owner.queueKey || owner.owner_queue || '').trim()
  return hasCatalogValue(QUEUE_DESTINATION_CATALOG, queueKey) && queueKey !== 'nao_aplicavel'
}

function buildFaqBuilderOwnershipReferenceCatalog(bundle = {}, options = {}) {
  const hasExplicitAreas = Array.isArray(options.operationalAreas)
  const hasBundleAreas = Array.isArray(bundle.operationalAreas) && bundle.operationalAreas.length > 0
  const hasMetadataAreas =
    Array.isArray(bundle.metadata?.operationalAreas) &&
    bundle.metadata.operationalAreas.length > 0
  const hasExplicitProfiles = Array.isArray(options.profiles) && options.profiles.length > 0
  const hasBundleProfiles = Array.isArray(bundle.profiles) && bundle.profiles.length > 0

  return buildOperationalOwnershipReferenceCatalog({
    operationalAreas: hasExplicitAreas
      ? options.operationalAreas
      : hasBundleAreas
        ? bundle.operationalAreas
        : hasMetadataAreas
          ? bundle.metadata.operationalAreas
          : null,
    profiles: hasExplicitProfiles
      ? options.profiles
      : hasBundleProfiles
        ? bundle.profiles
        : null,
  })
}

function resolveOperationalOwnerReferenceIssue(owner = {}, referenceCatalog = null) {
  const ownerType = normalizeOwnershipType(owner.ownerType || owner.owner_type)
  const normalizedCatalog = normalizeOperationalOwnershipReferenceCatalog(referenceCatalog || {})

  if (ownerType === OPERATIONAL_OWNER_TYPE.area) {
    const areaLabel = String(owner.areaLabel || owner.owner_area || '').trim()
    if (
      areaLabel &&
      !hasOperationalOwnershipReference(normalizedCatalog.areaSet, areaLabel)
    ) {
      return {
        code: 'owner_area_reference_invalid',
        field: 'owner_area',
        message: `Area referenciada no ownership nao existe: ${areaLabel}.`,
      }
    }
    return null
  }

  if (ownerType === OPERATIONAL_OWNER_TYPE.role) {
    const roleKey = String(owner.roleKey || owner.owner_role || '').trim()
    if (
      roleKey &&
      !hasOperationalOwnershipReference(normalizedCatalog.roleSet, roleKey)
    ) {
      return {
        code: 'owner_role_reference_invalid',
        field: 'owner_role',
        message: `Role referenciada no ownership nao existe: ${roleKey}.`,
      }
    }
    return null
  }

  const queueKey = String(owner.queueKey || owner.owner_queue || '').trim()
  if (
    queueKey &&
    !hasOperationalOwnershipReference(normalizedCatalog.queueSet, queueKey)
  ) {
    return {
      code: 'owner_queue_reference_invalid',
      field: 'owner_queue',
      message: `Fila referenciada no ownership nao existe: ${queueKey}.`,
    }
  }
  return null
}

function formatOperationalOwnerLabel(owner = {}) {
  const normalizedOwner = normalizeOperationalOwner(owner)
  if (normalizedOwner.ownerType === OPERATIONAL_OWNER_TYPE.area) {
    return normalizedOwner.areaLabel || 'Area nao informada'
  }
  if (normalizedOwner.ownerType === OPERATIONAL_OWNER_TYPE.role) {
    return normalizedOwner.roleKey || 'Role nao informada'
  }
  return normalizedOwner.queueLabel || normalizedOwner.queueKey || 'Fila nao informada'
}

function buildNodeParentMap(bundle = {}) {
  const parentMap = new Map()
  for (const link of bundle.links || []) {
    if (!link || link.ativo === false) {
      continue
    }
    if (!parentMap.has(link.child_node_id)) {
      parentMap.set(link.child_node_id, link.parent_node_id)
    }
  }
  return parentMap
}

function collectValidNodes(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).filter(
    (node) => node && typeof node === 'object' && String(node.id || '').trim(),
  )
}

function getNodeOwnershipConfig(node = {}, options = {}) {
  const rawOwnership = node.ownership && typeof node.ownership === 'object' ? node.ownership : {}
  const hasLegacyOverride =
    String(
      rawOwnership.ownerType ||
        node.owner_type ||
        rawOwnership.areaLabel ||
        node.owner_area ||
        rawOwnership.queueKey ||
        node.owner_queue ||
        rawOwnership.roleKey ||
        node.owner_role ||
        '',
    ).trim().length > 0
  const inherit = sanitizeOwnershipBoolean(
    rawOwnership.inherit ?? node.owner_inherit,
    options.defaultInherit ?? !hasLegacyOverride,
  )
  const normalizationOptions = {
    ...options,
  }
  if (!inherit) {
    normalizationOptions.fallbackQueue = ''
    normalizationOptions.fallbackArea = ''
    normalizationOptions.fallbackRole = ''
  }
  const operationalOwner = normalizeOperationalOwner(
    {
      ...rawOwnership,
      owner_type: rawOwnership.ownerType || node.owner_type,
      owner_queue:
        rawOwnership.queueKey ||
        node.owner_queue ||
        (inherit ? node.fila_destino : ''),
      owner_area: rawOwnership.areaLabel || node.owner_area || '',
      owner_role: rawOwnership.roleKey || node.owner_role || '',
      owner_routing_policy:
        rawOwnership.routingPolicy || node.owner_routing_policy || '',
      owner_fallback_note:
        rawOwnership.fallbackNote || node.owner_fallback_note || '',
    },
    normalizationOptions,
  )
  return {
    inherit,
    operationalOwner,
  }
}

function syncNodeOwnershipFields(node = {}, ownershipConfig = null) {
  if (!node || typeof node !== 'object' || !ownershipConfig) {
    return
  }
  const owner = ownershipConfig.operationalOwner
  node.ownership = {
    inherit: ownershipConfig.inherit,
    ownerType: owner.ownerType,
    queueKey: owner.queueKey,
    areaLabel: owner.areaLabel,
    roleKey: owner.roleKey,
    routingPolicy: owner.routingPolicy,
    fallbackNote: owner.fallbackNote,
    ownerKey: owner.ownerKey,
  }
  node.owner_inherit = ownershipConfig.inherit
  node.owner_type = owner.ownerType
  node.owner_queue = owner.queueKey
  node.owner_area = owner.areaLabel
  node.owner_role = owner.roleKey
  node.owner_routing_policy = owner.routingPolicy
  node.owner_fallback_note = owner.fallbackNote
  node.owner_key = owner.ownerKey
}

function ensureBundleOperationalOwner(bundle = {}) {
  const fallbackQueueFromNodes =
    (bundle.nodes || [])
      .map((node) => String(node?.fila_destino || '').trim())
      .find(
        (queue) =>
          hasCatalogValue(QUEUE_DESTINATION_CATALOG, queue) && queue !== 'nao_aplicavel',
      ) || resolveDefaultQueueByFaqType(bundle.tipo_faq)

  const normalizedOwner = normalizeOperationalOwner(
    bundle.operational_owner ||
      bundle.metadata?.operational_owner || {
        owner_type: OPERATIONAL_OWNER_TYPE.queue,
        owner_queue: fallbackQueueFromNodes,
      },
    {
      faqType: bundle.tipo_faq,
      fallbackQueue: fallbackQueueFromNodes,
    },
  )

  bundle.operational_owner = {
    ownerType: normalizedOwner.ownerType,
    queueKey: normalizedOwner.queueKey,
    queueLabel: normalizedOwner.queueLabel,
    areaLabel: normalizedOwner.areaLabel,
    roleKey: normalizedOwner.roleKey,
    ownerKey: normalizedOwner.ownerKey,
    routingPolicy: normalizedOwner.routingPolicy,
    fallbackNote: normalizedOwner.fallbackNote,
  }
  bundle.metadata = bundle.metadata || {}
  bundle.metadata.operational_owner = cloneJson(bundle.operational_owner)
}

function resolveNodeEffectiveOwner(nodeId = '', nodeById = new Map(), parentMap = new Map(), bundleOwner = {}) {
  const visited = new Set()
  let cursorId = nodeId

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId)
    const node = nodeById.get(cursorId)
    if (!node) {
      break
    }
    const ownershipConfig = getNodeOwnershipConfig(node, {
      fallbackQueue: bundleOwner.queueKey,
      faqType: node.tipo_faq,
    })
    if (!ownershipConfig.inherit && hasOperationalOwnerValue(ownershipConfig.operationalOwner)) {
      return {
        owner: ownershipConfig.operationalOwner,
        source: 'node_override',
        sourceNodeId: cursorId,
      }
    }
    cursorId = parentMap.get(cursorId) || ''
  }

  if (hasOperationalOwnerValue(bundleOwner)) {
    return {
      owner: bundleOwner,
      source: 'bundle_default',
      sourceNodeId: '',
    }
  }

  return {
    owner: null,
    source: 'missing',
    sourceNodeId: '',
  }
}

function ensureBundleCollections(bundle = {}) {
  if (!Array.isArray(bundle.nodes)) {
    bundle.nodes = []
  } else if (bundle.nodes.some((node) => !node || typeof node !== 'object')) {
    bundle.nodes = bundle.nodes.filter((node) => node && typeof node === 'object')
  }

  for (const node of bundle.nodes) {
    if (!node || typeof node !== 'object') {
      continue
    }
    const normalizedNodeId = String(node.id || node.node_id || node.nodeId || '').trim()
    if (normalizedNodeId) {
      node.id = normalizedNodeId
    }
  }

  if (!Array.isArray(bundle.links)) {
    bundle.links = []
  } else if (bundle.links.some((link) => !link || typeof link !== 'object')) {
    bundle.links = bundle.links.filter((link) => link && typeof link === 'object')
  }

  for (const link of bundle.links) {
    if (!link || typeof link !== 'object') {
      continue
    }
    const normalizedSourceId = String(
      link.parent_node_id || link.source || link.source_id || link.from || '',
    ).trim()
    const normalizedTargetId = String(
      link.child_node_id || link.target || link.target_id || link.to || '',
    ).trim()
    if (normalizedSourceId) {
      link.parent_node_id = normalizedSourceId
      link.source = normalizedSourceId
    }
    if (normalizedTargetId) {
      link.child_node_id = normalizedTargetId
      link.target = normalizedTargetId
    }
    if (!String(link.link_id || '').trim()) {
      const fallbackLinkId =
        String(link.id || link.edge_id || '').trim() ||
        (normalizedSourceId && normalizedTargetId
          ? buildLinkId(normalizedSourceId, normalizedTargetId)
          : '')
      if (fallbackLinkId) {
        link.link_id = fallbackLinkId
      }
    }
  }

  bundle.calendar_highlights = Array.isArray(bundle.calendar_highlights) ? bundle.calendar_highlights : []
  bundle.metadata = bundle.metadata || {}
  if (!bundle.publication || typeof bundle.publication !== 'object') {
    bundle.publication = {}
  }
  if (!bundle.versioning || typeof bundle.versioning !== 'object') {
    bundle.versioning = {}
  }

  if (bundle.publication.can_publish === undefined) bundle.publication.can_publish = true
  if (bundle.publication.last_published_at === undefined) bundle.publication.last_published_at = null
  if (bundle.publication.last_published_by === undefined) bundle.publication.last_published_by = ''
  if (bundle.publication.next_review_at === undefined) bundle.publication.next_review_at = null
  if (bundle.publication.effective_start_at === undefined) bundle.publication.effective_start_at = null
  if (bundle.publication.effective_end_at === undefined) bundle.publication.effective_end_at = null
  if (bundle.publication.priority === undefined) bundle.publication.priority = 50
  if (bundle.publication.display_rank === undefined) bundle.publication.display_rank = 50
  if (bundle.publication.is_featured === undefined) bundle.publication.is_featured = false
  if (bundle.publication.conditions === undefined) bundle.publication.conditions = ''
  if (bundle.publication.active_bundle_version_id === undefined) {
    bundle.publication.active_bundle_version_id = ''
  }
  if (bundle.publication.supersedes_version_id === undefined) {
    bundle.publication.supersedes_version_id = ''
  }

  bundle.versioning.draft_version = bundle.versioning.draft_version || 'draft-local'
  bundle.versioning.published_version = bundle.versioning.published_version || ''
  bundle.versioning.publication_status = bundle.versioning.publication_status || 'draft'
  bundle.versioning.change_summary = bundle.versioning.change_summary || ''
  bundle.versioning.import_source = bundle.versioning.import_source || 'builder'
  bundle.versioning.base_version = bundle.versioning.base_version || ''
  bundle.versioning.draft_revision = Number(bundle.versioning.draft_revision || 1)

  ensureBundleOperationalOwner(bundle)
  const fallbackQueue = bundle.operational_owner?.queueKey || resolveDefaultQueueByFaqType(bundle.tipo_faq)
  for (const node of bundle.nodes) {
    const ownershipConfig = getNodeOwnershipConfig(node, {
      faqType: bundle.tipo_faq,
      fallbackQueue,
    })
    syncNodeOwnershipFields(node, ownershipConfig)
  }

  return bundle
}

function sanitizeNumericValue(value, fallback = 0) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function sanitizeFaqBuilderBundleForRuntime(bundle = {}, options = {}) {
  const maxNodes = Number(options.maxNodes || FAQ_BUILDER_RUNTIME_GUARDS.maxRenderNodes)
  const maxEdges = Number(options.maxEdges || FAQ_BUILDER_RUNTIME_GUARDS.maxRenderEdges)
  const mode = options.mode || 'default'

  const sanitizedBundle = ensureBundleCollections(cloneJson(bundle || {}))
  const warnings = []
  const errors = []

  const inputNodes = Array.isArray(sanitizedBundle.nodes) ? sanitizedBundle.nodes : []
  const inputLinks = Array.isArray(sanitizedBundle.links) ? sanitizedBundle.links : []
  const nodeIds = new Set()
  const normalizedNodes = []

  for (const node of inputNodes) {
    const nodeId = String(node?.id || node?.node_id || node?.nodeId || '').trim()
    if (!nodeId) {
      warnings.push({
        code: 'runtime_node_without_id',
        message: 'No sem ID foi ignorado durante abertura do builder.',
      })
      continue
    }

    if (nodeIds.has(nodeId)) {
      warnings.push({
        code: 'runtime_duplicate_node_id',
        message: `ID duplicado (${nodeId}) foi ignorado durante abertura do builder.`,
      })
      continue
    }

    nodeIds.add(nodeId)
    normalizedNodes.push({
      ...node,
      id: nodeId,
      node_id: nodeId,
    })

    if (normalizedNodes.length >= maxNodes) {
      errors.push({
        code: 'runtime_nodes_limit_exceeded',
        message: `Fluxo acima do limite seguro de renderizacao (${maxNodes} nos).`,
      })
      break
    }
  }

  const validNodeIds = new Set(normalizedNodes.map((node) => node.id))
  const normalizedLinks = []
  const linkIds = new Set()
  const linkPairs = new Set()

  for (const link of inputLinks) {
    const sourceId = String(
      link?.parent_node_id || link?.source || link?.source_id || link?.from || '',
    ).trim()
    const targetId = String(
      link?.child_node_id || link?.target || link?.target_id || link?.to || '',
    ).trim()
    const active = link?.ativo !== false

    if (!active) {
      continue
    }

    if (!sourceId || !targetId) {
      warnings.push({
        code: 'runtime_link_without_source_or_target',
        message: 'Link invalido (origem/destino vazio) foi ignorado.',
      })
      continue
    }

    if (!validNodeIds.has(sourceId) || !validNodeIds.has(targetId)) {
      warnings.push({
        code: 'runtime_link_missing_node',
        message: `Link ${sourceId} -> ${targetId} aponta para no inexistente e foi ignorado.`,
      })
      continue
    }

    if (sourceId === targetId) {
      warnings.push({
        code: 'runtime_self_loop_dropped',
        message: `Auto-referencia em ${sourceId} foi ignorada no render.`,
      })
      continue
    }

    const normalizedLinkId = String(link?.link_id || '').trim() || buildLinkId(sourceId, targetId)
    const pairKey = `${sourceId}=>${targetId}`
    if (linkIds.has(normalizedLinkId) || linkPairs.has(pairKey)) {
      warnings.push({
        code: 'runtime_duplicate_link',
        message: `Link duplicado (${sourceId} -> ${targetId}) foi ignorado.`,
      })
      continue
    }

    linkIds.add(normalizedLinkId)
    linkPairs.add(pairKey)
    normalizedLinks.push({
      ...link,
      link_id: normalizedLinkId,
      parent_node_id: sourceId,
      child_node_id: targetId,
      source: sourceId,
      target: targetId,
      ativo: true,
    })

    if (normalizedLinks.length >= maxEdges) {
      errors.push({
        code: 'runtime_edges_limit_exceeded',
        message: `Fluxo acima do limite seguro de conexoes (${maxEdges} links).`,
      })
      break
    }
  }

  sanitizedBundle.nodes = normalizedNodes
  sanitizedBundle.links = normalizedLinks
  sanitizedBundle.metadata = {
    ...(sanitizedBundle.metadata || {}),
    runtime_mode: mode,
  }

  return {
    bundle: sanitizedBundle,
    warnings,
    errors,
  }
}

function sanitizeFaqBuilderCanvasSnapshot(snapshot = {}, bundle = {}) {
  const safeSnapshot = {
    ...cloneJson(DEFAULT_CANVAS_SNAPSHOT),
    ...(snapshot && typeof snapshot === 'object' ? cloneJson(snapshot) : {}),
  }
  const nodePositions = safeSnapshot.nodePositions && typeof safeSnapshot.nodePositions === 'object'
    ? safeSnapshot.nodePositions
    : {}

  safeSnapshot.nodePositions = {}
  safeSnapshot.edges = []
  safeSnapshot.viewport = {
    x: sanitizeNumericValue(safeSnapshot.viewport?.x, 0),
    y: sanitizeNumericValue(safeSnapshot.viewport?.y, 0),
    zoom: sanitizeNumericValue(safeSnapshot.viewport?.zoom, 1),
  }

  const nodes = Array.isArray(bundle?.nodes) ? bundle.nodes : []
  nodes.forEach((node, index) => {
    const nodeId = String(node?.id || '').trim()
    if (!nodeId) {
      return
    }
    const savedPosition = nodePositions[nodeId] || {}
    const row = Math.floor(index / 4)
    const col = index % 4
    safeSnapshot.nodePositions[nodeId] = {
      x: Math.round(sanitizeNumericValue(savedPosition.x, 80 + col * 320)),
      y: Math.round(sanitizeNumericValue(savedPosition.y, 80 + row * 180)),
    }
  })

  const links = Array.isArray(bundle?.links) ? bundle.links : []
  safeSnapshot.edges = links
    .filter((link) => link.ativo !== false)
    .map((link) => ({
      id:
        String(link.link_id || '').trim() ||
        buildLinkId(
          String(link.parent_node_id || '').trim(),
          String(link.child_node_id || '').trim(),
        ),
      source: String(link.parent_node_id || '').trim(),
      target: String(link.child_node_id || '').trim(),
    }))

  safeSnapshot.updatedAt = nowIso()
  return safeSnapshot
}

export function runFaqBuilderBundleSanityCheck(
  bundle = {},
  canvasSnapshot = {},
  options = {},
) {
  try {
    const sanitized = sanitizeFaqBuilderBundleForRuntime(bundle, options)
    const snapshot = sanitizeFaqBuilderCanvasSnapshot(canvasSnapshot, sanitized.bundle)
    const blockingErrors = sanitized.errors.filter((issue) =>
      ['runtime_nodes_limit_exceeded', 'runtime_edges_limit_exceeded'].includes(issue.code),
    )
    return {
      ok: blockingErrors.length === 0,
      bundle: sanitized.bundle,
      canvasSnapshot: snapshot,
      errors: sanitized.errors,
      warnings: sanitized.warnings,
      shouldUseSafeMode: blockingErrors.length > 0,
    }
  } catch (error) {
    return {
      ok: false,
      bundle: ensureBundleCollections({
        ...(cloneJson(bundle || {})),
        nodes: [],
        links: [],
      }),
      canvasSnapshot: cloneJson(DEFAULT_CANVAS_SNAPSHOT),
      errors: [
        {
          code: 'runtime_sanity_failed',
          message: String(error?.message || 'Falha ao sanitizar o fluxo.'),
        },
      ],
      warnings: [],
      shouldUseSafeMode: true,
    }
  }
}

function buildIncomingMap(links = []) {
  const map = new Map()
  const safeLinks = Array.isArray(links) ? links : []
  for (const link of safeLinks) {
    if (!link || typeof link !== 'object' || link.ativo === false) {
      continue
    }
    const childId = String(link.child_node_id || '').trim()
    if (!childId) {
      continue
    }
    const current = map.get(childId) || []
    map.set(childId, [...current, link])
  }
  return map
}

function buildOutgoingMap(links = []) {
  const map = new Map()
  const safeLinks = Array.isArray(links) ? links : []
  for (const link of safeLinks) {
    if (!link || typeof link !== 'object' || link.ativo === false) {
      continue
    }
    const parentId = String(link.parent_node_id || '').trim()
    if (!parentId) {
      continue
    }
    const current = map.get(parentId) || []
    map.set(parentId, [...current, link])
  }
  return map
}

function buildAdjacency(nodes = [], links = []) {
  const adjacency = new Map()
  const safeNodes = Array.isArray(nodes) ? nodes : []
  const safeLinks = Array.isArray(links) ? links : []

  for (const node of safeNodes) {
    if (!node || typeof node !== 'object') {
      continue
    }
    const nodeId = String(node.id || '').trim()
    if (!nodeId || adjacency.has(nodeId)) {
      continue
    }
    adjacency.set(nodeId, [])
  }

  for (const link of safeLinks) {
    if (!link || typeof link !== 'object' || link.ativo === false) {
      continue
    }
    const parentId = String(link.parent_node_id || '').trim()
    const childId = String(link.child_node_id || '').trim()
    if (!parentId || !childId || !adjacency.has(parentId) || !adjacency.has(childId)) {
      continue
    }
    adjacency.get(parentId).push(childId)
  }
  return adjacency
}

function detectCycles(nodes = [], links = []) {
  const adjacency = buildAdjacency(nodes, links)
  const visitState = new Map() // idle | visiting | done
  const cycleNodeIds = new Set()
  const stack = []

  const safeNodes = Array.isArray(nodes) ? nodes : []
  for (const node of safeNodes) {
    if (!node || typeof node !== 'object') {
      continue
    }
    const nodeId = String(node.id || '').trim()
    if (!nodeId || !adjacency.has(nodeId) || visitState.get(nodeId) === 'done') {
      continue
    }

    stack.push({ nodeId, index: 0 })

    while (stack.length) {
      const current = stack[stack.length - 1]
      const currentState = visitState.get(current.nodeId)
      if (!currentState) {
        visitState.set(current.nodeId, 'visiting')
      }

      const children = adjacency.get(current.nodeId) || []
      if (current.index >= children.length) {
        visitState.set(current.nodeId, 'done')
        stack.pop()
        continue
      }

      const childId = children[current.index]
      current.index += 1
      const childState = visitState.get(childId)

      if (childState === 'visiting') {
        cycleNodeIds.add(childId)
        for (const item of stack) {
          cycleNodeIds.add(item.nodeId)
        }
        continue
      }

      if (childState === 'done') {
        continue
      }

      stack.push({ nodeId: childId, index: 0 })
    }
  }

  return [...cycleNodeIds]
}

function nextNodeOrder(outgoingMap, parentId) {
  const links = outgoingMap.get(parentId) || []
  if (!links.length) {
    return 1
  }
  return links.reduce((maxOrder, link) => Math.max(maxOrder, Number(link.ordem || 0)), 0) + 1
}

function buildNodeValidationIssueSummary(issues = []) {
  const map = new Map()

  for (const issue of issues) {
    if (!issue.nodeId) {
      continue
    }

    const current = map.get(issue.nodeId) || {
      hasError: false,
      hasWarning: false,
      count: 0,
      labels: [],
    }

    current.count += 1
    current.hasError = current.hasError || issue.severity === 'error'
    current.hasWarning = current.hasWarning || issue.severity === 'warning'

    if (current.labels.length < 3) {
      current.labels.push(issue.message)
    }

    map.set(issue.nodeId, current)
  }

  return map
}

function collectDescendants(nodeId, outgoingMap, visited = new Set()) {
  const queue = [nodeId]
  while (queue.length) {
    const current = queue.pop()
    const outgoingLinks = outgoingMap.get(current) || []
    for (const link of outgoingLinks) {
      const childId = link.child_node_id
      if (visited.has(childId)) {
        continue
      }
      visited.add(childId)
      queue.push(childId)
    }
  }
  return visited
}

function inferRootIds(nodes = [], incomingMap = new Map()) {
  const safeNodes = collectValidNodes(nodes)
  return safeNodes
    .filter((node) => !(incomingMap.get(String(node.id || '').trim()) || []).length)
    .map((node) => String(node.id || '').trim())
}

function buildImportIssue({ row = null, field = '', code = '', message = '', suggestion = '', severity = 'error' }) {
  return {
    row,
    field,
    code,
    message,
    suggestion,
    severity,
  }
}

function normalizeImportRow(rawRow = {}) {
  const normalized = {}

  for (const [key, value] of Object.entries(rawRow)) {
    const canonicalKey = HEADER_ALIAS_MAP[normalizeHeaderKey(key)] || null
    if (!canonicalKey) {
      continue
    }

    normalized[canonicalKey] = String(value ?? '').trim()
  }

  return normalized
}

function buildImportTemplateRows(faqType = 'aluno') {
  const queueDefault = resolveDefaultQueueByFaqType(faqType)

  return [
    {
      node_id: `faq-${faqType}-tema-exemplo`,
      short_title: 'Assunto principal',
      node_type: 'path',
      parent_id: '',
      response_content: '',
      closing_action: 'ir_para_subniveis',
      child_order: 1,
      theme: 'assunto_principal',
      subtheme: 'geral',
      status: 'draft',
      internal_note: 'No raiz da arvore.',
      queue_destination: queueDefault,
      criticality: 'media',
      sla: '48h',
      owner_inherit: 'sim',
      owner_type: '',
      owner_area: '',
      owner_queue: '',
      owner_role: '',
      owner_routing_policy: '',
      owner_fallback_note: '',
      bundle_owner_type: 'queue',
      bundle_owner_area: '',
      bundle_owner_queue: queueDefault,
      bundle_owner_role: '',
      bundle_owner_routing_policy: 'balancear_por_carga',
      bundle_owner_fallback_note: 'Responsavel padrao do fluxo.',
      slug: `assunto-principal-${faqType}`,
      tags: 'principal,onboarding',
    },
    {
      node_id: `faq-${faqType}-ramo-exemplo`,
      short_title: 'Escolha de caminho',
      node_type: 'path',
      parent_id: `faq-${faqType}-tema-exemplo`,
      response_content: '',
      closing_action: 'ir_para_subniveis',
      child_order: 1,
      theme: 'assunto_principal',
      subtheme: 'opcoes',
      status: 'draft',
      internal_note: 'Ramo intermediario.',
      queue_destination: queueDefault,
      criticality: 'media',
      sla: '48h',
      owner_inherit: 'sim',
      owner_type: '',
      owner_area: '',
      owner_queue: '',
      owner_role: '',
      owner_routing_policy: '',
      owner_fallback_note: '',
      bundle_owner_type: '',
      bundle_owner_area: '',
      bundle_owner_queue: '',
      bundle_owner_role: '',
      bundle_owner_routing_policy: '',
      bundle_owner_fallback_note: '',
      slug: `caminho-${faqType}`,
      tags: 'ramo',
    },
    {
      node_id: `faq-${faqType}-resposta-exemplo`,
      short_title: 'Resposta final exemplo',
      node_type: 'final',
      parent_id: `faq-${faqType}-ramo-exemplo`,
      response_content: 'Texto final mostrado para o usuario.',
      closing_action: 'mostrar_resposta',
      child_order: 1,
      theme: 'assunto_principal',
      subtheme: 'resposta',
      status: 'draft',
      internal_note: 'Folha final do fluxo.',
      queue_destination: queueDefault,
      criticality: 'media',
      sla: '48h',
      owner_inherit: 'sim',
      owner_type: '',
      owner_area: '',
      owner_queue: '',
      owner_role: '',
      owner_routing_policy: '',
      owner_fallback_note: '',
      bundle_owner_type: '',
      bundle_owner_area: '',
      bundle_owner_queue: '',
      bundle_owner_role: '',
      bundle_owner_routing_policy: '',
      bundle_owner_fallback_note: '',
      slug: `resposta-final-${faqType}`,
      tags: 'final,resposta',
    },
  ]
}

function buildImportInstructionsRows() {
  return FAQ_BUILDER_SPREADSHEET_COLUMNS.map((column) => ({
    column: column.label,
    required: column.required ? 'yes' : 'no',
    description: column.description,
  }))
}

function buildLinkId(parentId = '', childId = '') {
  return `link-${normalizeText(parentId)}-${normalizeText(childId)}`
}

function getWorkspaceStorageKey(faqType = 'aluno') {
  return `${FAQ_BUILDER_LOCAL_STORAGE_PREFIX}:${faqType}`
}

export function getFaqBuilderCatalogOptions() {
  const queues = buildCatalogOptions(QUEUE_DESTINATION_CATALOG)
  const slas = buildCatalogOptions(SLA_CATALOG)
  return {
    faqTypes: buildCatalogOptions(FAQ_TYPE_CATALOG),
    actions: buildCatalogOptions(ACTION_CATALOG),
    queues,
    queueDestinations: queues,
    criticalities: buildCatalogOptions(CRITICALITY_CATALOG),
    slas,
    slaOptions: slas,
    nodeModes: [
      { value: NODE_MODE_MAP.path, label: 'Caminho / roteamento' },
      { value: NODE_MODE_MAP.final, label: 'Resposta final' },
    ],
    workflowStatuses: FAQ_BUILDER_WORKFLOW_OPTIONS.map((status) => ({
      value: status,
      label: status,
    })),
    operationalOwnerTypes: [
      { value: OPERATIONAL_OWNER_TYPE.queue, label: 'Fila operacional' },
      { value: OPERATIONAL_OWNER_TYPE.area, label: 'Area operacional' },
      { value: OPERATIONAL_OWNER_TYPE.role, label: 'Perfil operacional' },
    ],
  }
}

export function setFaqBuilderBundleOperationalOwner(bundle = {}, payload = {}) {
  ensureBundleCollections(bundle)
  const nextOwner = normalizeOperationalOwner(
    {
      ...(bundle.operational_owner || {}),
      ...payload,
    },
    {
      faqType: bundle.tipo_faq,
      fallbackQueue:
        bundle.operational_owner?.queueKey || resolveDefaultQueueByFaqType(bundle.tipo_faq),
    },
  )
  bundle.operational_owner = {
    ownerType: nextOwner.ownerType,
    queueKey: nextOwner.queueKey,
    queueLabel: nextOwner.queueLabel,
    areaLabel: nextOwner.areaLabel,
    roleKey: nextOwner.roleKey,
    ownerKey: nextOwner.ownerKey,
    routingPolicy: nextOwner.routingPolicy,
    fallbackNote: nextOwner.fallbackNote,
  }
  bundle.metadata = bundle.metadata || {}
  bundle.metadata.operational_owner = cloneJson(bundle.operational_owner)
  return bundle.operational_owner
}

export function setFaqBuilderNodeOwnership(bundle = {}, nodeId = '', payload = {}) {
  ensureBundleCollections(bundle)
  const node = getFaqBuilderNode(bundle, nodeId)
  if (!node) {
    return null
  }

  const currentConfig = getNodeOwnershipConfig(node, {
    faqType: bundle.tipo_faq,
    fallbackQueue: bundle.operational_owner?.queueKey,
  })
  const nextConfig = {
    inherit:
      payload.inherit === undefined
        ? currentConfig.inherit
        : sanitizeOwnershipBoolean(payload.inherit, currentConfig.inherit),
  }
  const ownerNormalizationOptions = {
    faqType: bundle.tipo_faq,
    fallbackQueue:
      bundle.operational_owner?.queueKey || currentConfig.operationalOwner.queueKey,
  }
  if (!nextConfig.inherit) {
    ownerNormalizationOptions.fallbackQueue = ''
    ownerNormalizationOptions.fallbackArea = ''
    ownerNormalizationOptions.fallbackRole = ''
  }
  nextConfig.operationalOwner = normalizeOperationalOwner(
    {
      ...currentConfig.operationalOwner,
      ...payload,
    },
    ownerNormalizationOptions,
  )
  syncNodeOwnershipFields(node, nextConfig)
  return node.ownership
}

export function resolveFaqBuilderNodeEffectiveOwner(bundle = {}, nodeId = '') {
  ensureBundleCollections(bundle)
  const nodeById = new Map(
    collectValidNodes(bundle.nodes).map((node) => [String(node.id || '').trim(), node]),
  )
  const parentMap = buildNodeParentMap(bundle)
  return resolveNodeEffectiveOwner(
    nodeId,
    nodeById,
    parentMap,
    bundle.operational_owner || {},
  )
}

export function resolveFaqNodeOperationalOwner({
  node = {},
  lineage = [],
  bundleOwner = null,
  faqType = '',
} = {}) {
  const safeLineage = Array.isArray(lineage)
    ? lineage.filter(
        (entry) => entry && typeof entry === 'object' && String(entry.id || '').trim(),
      )
    : []
  const resolvedFaqType = faqType || node.tipo_faq || safeLineage.at(-1)?.tipo_faq || 'aluno'
  const defaultBundleOwner = normalizeOperationalOwner(
    bundleOwner ||
      node.bundle_operational_owner ||
      node.metadata?.operational_owner ||
      {},
    {
      faqType: resolvedFaqType,
      fallbackQueue:
        resolveDefaultQueueByFaqType(resolvedFaqType),
    },
  )

  const fallbackOwner = normalizeOperationalOwner(
    {
      owner_type: OPERATIONAL_OWNER_TYPE.queue,
      owner_queue:
        String(node.owner_queue || node.fila_destino || '').trim() ||
        defaultBundleOwner.queueKey ||
        resolveDefaultQueueByFaqType(resolvedFaqType),
    },
    {
      faqType: resolvedFaqType,
      fallbackQueue: defaultBundleOwner.queueKey || resolveDefaultQueueByFaqType(resolvedFaqType),
    },
  )

  const lineageToCheck = safeLineage.length
    ? [...safeLineage].reverse()
    : [node]

  for (const lineageNode of lineageToCheck) {
    const ownershipConfig = getNodeOwnershipConfig(lineageNode, {
      faqType: resolvedFaqType,
      fallbackQueue: defaultBundleOwner.queueKey || fallbackOwner.queueKey,
    })
    if (!ownershipConfig.inherit && hasOperationalOwnerValue(ownershipConfig.operationalOwner)) {
      return {
        hasOwner: true,
        source: lineageNode.id === node.id ? 'node_override' : 'ancestor_override',
        sourceNodeId: lineageNode.id,
        ownerType: ownershipConfig.operationalOwner.ownerType,
        ownerKey: ownershipConfig.operationalOwner.ownerKey,
        areaLabel: ownershipConfig.operationalOwner.areaLabel,
        queueKey: ownershipConfig.operationalOwner.queueKey,
        queueLabel: ownershipConfig.operationalOwner.queueLabel,
        roleKey: ownershipConfig.operationalOwner.roleKey,
        routingPolicy: ownershipConfig.operationalOwner.routingPolicy,
      }
    }
  }

  if (hasOperationalOwnerValue(defaultBundleOwner)) {
    return {
      hasOwner: true,
      source: 'bundle_default',
      sourceNodeId: '',
      ownerType: defaultBundleOwner.ownerType,
      ownerKey: defaultBundleOwner.ownerKey,
      areaLabel: defaultBundleOwner.areaLabel,
      queueKey: defaultBundleOwner.queueKey,
      queueLabel: defaultBundleOwner.queueLabel,
      roleKey: defaultBundleOwner.roleKey,
      routingPolicy: defaultBundleOwner.routingPolicy,
    }
  }

  if (hasOperationalOwnerValue(fallbackOwner)) {
    return {
      hasOwner: true,
      source: 'node_queue_fallback',
      sourceNodeId: node.id || '',
      ownerType: fallbackOwner.ownerType,
      ownerKey: fallbackOwner.ownerKey,
      areaLabel: fallbackOwner.areaLabel,
      queueKey: fallbackOwner.queueKey,
      queueLabel: fallbackOwner.queueLabel,
      roleKey: fallbackOwner.roleKey,
      routingPolicy: fallbackOwner.routingPolicy,
    }
  }

  return {
    hasOwner: false,
    source: 'missing',
    sourceNodeId: '',
    ownerType: '',
    ownerKey: '',
    areaLabel: '',
    queueKey: '',
    queueLabel: '',
    roleKey: '',
    routingPolicy: '',
  }
}

export function cloneFaqBuilderPackage(faqType = 'aluno') {
  return ensureBundleCollections(cloneJson(FAQ_PACKAGE_MAP[faqType] || FAQ_PACKAGE_MAP.aluno))
}

const PORTAL_FAQ_EXPORT_SCHEMA_VERSION = 'portal-faq-export-v1'
const PORTAL_FAQ_EXPORT_ALLOWED_AUDIENCES = Object.freeze([
  Object.freeze(['candidato']),
  Object.freeze(['op']),
  Object.freeze(['candidato', 'op']),
])

function buildPortalExportTimestamp(currentDate = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    currentDate.getFullYear(),
    pad(currentDate.getMonth() + 1),
    pad(currentDate.getDate()),
  ].join('') + `-${pad(currentDate.getHours())}${pad(currentDate.getMinutes())}`
}

function normalizePortalExportRoute(value = '') {
  return String(value || '').trim()
}

function isValidPortalExportRoute(value = '') {
  const route = normalizePortalExportRoute(value)
  if (!route || !route.startsWith('/') || route.startsWith('//')) {
    return false
  }
  const normalized = route.toLowerCase()
  const hasControlOrWhitespace = [...route].some((character) => {
    const code = character.charCodeAt(0)
    return /\s/.test(character) || code <= 31 || code === 127
  })
  const hasExternalDomainLikePrefix = /^\/(?:[^/?#]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(route)
  const usesCrmInternalRoute =
    normalized === '/admin' ||
    normalized.startsWith('/admin/') ||
    normalized === '/crm/admin' ||
    normalized.startsWith('/crm/admin/')
  return !(
    hasControlOrWhitespace ||
    hasExternalDomainLikePrefix ||
    usesCrmInternalRoute ||
    normalized.includes('javascript:') ||
    normalized.includes('http://') ||
    normalized.includes('https://') ||
    normalized.includes('://')
  )
}

function normalizePortalExportAudience(value = []) {
  const audience = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  return [...new Set(audience)].sort()
}

function hasAllowedPortalExportAudience(value = []) {
  const normalized = normalizePortalExportAudience(value)
  return PORTAL_FAQ_EXPORT_ALLOWED_AUDIENCES.some(
    (allowed) =>
      allowed.length === normalized.length &&
      allowed.every((item, index) => item === normalized[index]),
  )
}

function buildPortalExportTreeItems(bundle = {}) {
  const nodes = collectValidNodes(bundle.nodes)
  const activeLinks = (bundle.links || []).filter((link) => link && link.ativo !== false)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoingMap = buildOutgoingMap(activeLinks)
  const incomingMap = buildIncomingMap(activeLinks)
  const rootIds = inferRootIds(nodes, incomingMap)

  function mapNode(nodeId = '') {
    const node = nodeById.get(nodeId)
    if (!node) {
      return null
    }
    const children = (outgoingMap.get(node.id) || [])
      .map((link) => mapNode(link.child_node_id))
      .filter(Boolean)
    const isTerminal = inferNodeMode(node) === NODE_MODE_MAP.final
    const mapped = {
      id: node.id,
      type: isTerminal ? 'answer' : 'section',
      title: String(node.titulo_exibido || '').trim(),
      question: String(node.pergunta_exibida || node.titulo_exibido || '').trim(),
    }
    if (isTerminal) {
      mapped.answer = String(node.resposta || '').trim()
      if (Array.isArray(node.palavras_chave) && node.palavras_chave.length) {
        mapped.keywords = [...node.palavras_chave]
      }
    } else {
      mapped.children = children
    }
    return mapped
  }

  return rootIds.map((rootId) => mapNode(rootId)).filter(Boolean)
}

function buildPortalExportChecksumSeed(payload = {}) {
  const clone = cloneJson(payload)
  delete clone.checksum
  return JSON.stringify(clone)
}

async function buildPortalExportChecksum(payload = {}) {
  if (
    typeof crypto === 'undefined' ||
    !crypto?.subtle ||
    typeof TextEncoder === 'undefined'
  ) {
    return ''
  }
  const encoded = new TextEncoder().encode(buildPortalExportChecksumSeed(payload))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = Array.from(new Uint8Array(digest))
  return `sha256-${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function normalizePortalSecondaryActions(actions = []) {
  if (!Array.isArray(actions)) {
    return []
  }
  return actions
    .map((action) => ({
      label: String(action?.label || '').trim(),
      route: normalizePortalExportRoute(action?.route),
    }))
}

export function validateFaqBuilderPortalExport(bundle = {}, options = {}) {
  const structuralValidation = validateFaqBuilderBundle(bundle, { mutateInput: false })
  const errors = structuralValidation.errors
    .filter((issue) =>
      [
        'duplicate_node_id',
        'orphan_node',
        'cycle_detected',
        'final_without_response',
      ].includes(issue.code),
    )
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
    }))
  const process = String(options.process || '').trim()
  const audience = normalizePortalExportAudience(options.audience)
  const primaryAction = {
    label: String(options.primaryAction?.label || '').trim(),
    route: normalizePortalExportRoute(options.primaryAction?.route),
  }
  const hasAnyPrimaryActionField = Boolean(primaryAction.label || primaryAction.route)

  if (!process) {
    errors.push({ code: 'missing_process', message: 'Informe o processo do portal externo.' })
  }
  if (!hasAllowedPortalExportAudience(audience)) {
    errors.push({ code: 'invalid_audience', message: 'Selecione um publico valido para exportacao.' })
  }
  if (hasAnyPrimaryActionField) {
    if (!primaryAction.label) {
      errors.push({
        code: 'missing_primary_action_label',
        message: 'Informe o rotulo da acao principal ou deixe a acao inteira vazia.',
      })
    }
    if (!primaryAction.route) {
      errors.push({
        code: 'missing_primary_action_route',
        message: 'Informe a rota da acao principal ou deixe a acao inteira vazia.',
      })
    } else if (!isValidPortalExportRoute(primaryAction.route)) {
      errors.push({
        code: 'invalid_primary_action_route',
        message: 'Informe uma rota relativa valida do portal externo.',
      })
    }
  }

  for (const action of normalizePortalSecondaryActions(options.secondaryActions)) {
    const hasAnySecondaryActionField = Boolean(action.label || action.route)
    if (!hasAnySecondaryActionField) {
      continue
    }
    if (!action.label) {
      errors.push({
        code: 'missing_secondary_action_label',
        message: 'Acao secundaria com rota precisa de rotulo.',
      })
    }
    if (!action.route) {
      errors.push({
        code: 'missing_secondary_action_route',
        message: 'Acao secundaria com rotulo precisa de rota.',
      })
    } else if (!isValidPortalExportRoute(action.route)) {
      errors.push({
        code: 'invalid_secondary_action_route',
        message: `Rota secundaria invalida: ${action.route}.`,
      })
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    audience,
  }
}

export async function buildFaqBuilderPortalExportPayload(
  bundle = {},
  {
    sourceBundleId = '',
    process = '',
    audience = [],
    version = '',
    primaryAction = {},
    secondaryActions = [],
    currentDate = new Date(),
  } = {},
) {
  const validation = validateFaqBuilderPortalExport(bundle, {
    process,
    audience,
    version,
    primaryAction,
    secondaryActions,
  })
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      payload: null,
    }
  }

  const timestamp = buildPortalExportTimestamp(currentDate)
  const normalizedProcess = slugify(process || bundle.metadata?.subject_key || bundle.metadata?.title || 'faq')
  const normalizedVersion = String(version || '').trim() || `draft-${timestamp}`
  const normalizedPrimaryAction = {
    label: String(primaryAction.label || '').trim(),
    route: normalizePortalExportRoute(primaryAction.route),
  }
  const payload = {
    schemaVersion: PORTAL_FAQ_EXPORT_SCHEMA_VERSION,
    exportId: `faq-${normalizedProcess || 'faq'}-draft-${timestamp}`,
    faqTitle: String(bundle.metadata?.title || '').trim(),
    sourceBundleId: String(sourceBundleId || bundle.metadata?.bundle_id || '').trim(),
    exportedAt: currentDate.toISOString(),
    exportedFrom: 'draft',
    version: normalizedVersion,
    audience: validation.audience,
    process: String(process || '').trim(),
    items: buildPortalExportTreeItems(bundle),
  }
  if (normalizedPrimaryAction.label && normalizedPrimaryAction.route) {
    payload.primaryAction = normalizedPrimaryAction
  }
  const normalizedSecondaryActions = normalizePortalSecondaryActions(secondaryActions)
    .filter((action) => action.label && action.route)
  if (normalizedSecondaryActions.length) {
    payload.secondaryActions = normalizedSecondaryActions
  }
  const checksum = await buildPortalExportChecksum(payload)
  if (checksum) {
    payload.checksum = checksum
  }
  return {
    ok: true,
    errors: [],
    payload,
  }
}

export function buildFaqBuilderPortalExportFileName(
  process = '',
  currentDate = new Date(),
  fallbackTitle = '',
) {
  const normalizedProcess = slugify(process || fallbackTitle || 'matricula-2026') || 'matricula-2026'
  return `faq-${normalizedProcess}-draft-${buildPortalExportTimestamp(currentDate)}.json`
}

export function validateFaqBuilderBundle(bundle = {}, options = {}) {
  const mode = options.mode || 'edit'
  const mutateInput = options.mutateInput === true
  const targetBundle = mutateInput
    ? ensureBundleCollections(bundle || {})
    : ensureBundleCollections(cloneJson(bundle || {}))
  const nodes = targetBundle.nodes || []
  const links = targetBundle.links || []
  const maxValidationNodes = Number(
    options.maxValidationNodes || FAQ_BUILDER_RUNTIME_GUARDS.maxValidationNodes,
  )
  const maxValidationEdges = Number(
    options.maxValidationEdges || FAQ_BUILDER_RUNTIME_GUARDS.maxValidationEdges,
  )
  const issues = []
  if (nodes.length > maxValidationNodes) {
    issues.push({
      severity: 'error',
      code: 'validation_nodes_limit_exceeded',
      nodeId: '',
      message: `Fluxo excede limite seguro de validacao (${maxValidationNodes} nos).`,
      blocksImport: true,
      blocksPublish: true,
    })
  }
  if (links.length > maxValidationEdges) {
    issues.push({
      severity: 'error',
      code: 'validation_edges_limit_exceeded',
      nodeId: '',
      message: `Fluxo excede limite seguro de validacao (${maxValidationEdges} links).`,
      blocksImport: true,
      blocksPublish: true,
    })
  }

  const workingNodes =
    nodes.length > maxValidationNodes ? nodes.slice(0, maxValidationNodes) : nodes
  const workingLinks =
    links.length > maxValidationEdges ? links.slice(0, maxValidationEdges) : links
  const validWorkingNodes = workingNodes.filter(
    (node) =>
      node &&
      typeof node === 'object' &&
      String(node.id || '').trim(),
  )

  const seenNodeIds = new Set()
  const seenLinkIds = new Set()
  const nodeById = new Map()
  const incomingMap = buildIncomingMap(workingLinks)
  const outgoingMap = buildOutgoingMap(workingLinks)
  const parentMap = buildNodeParentMap({
    nodes: validWorkingNodes,
    links: workingLinks,
  })
  const bundleOwner = normalizeOperationalOwner(targetBundle.operational_owner || targetBundle.metadata?.operational_owner || {}, {
    faqType: targetBundle.tipo_faq,
    fallbackQueue: resolveDefaultQueueByFaqType(targetBundle.tipo_faq),
  })
  const ownershipReferenceCatalog = buildFaqBuilderOwnershipReferenceCatalog(targetBundle, options)
  const bundleOwnerReferenceIssue = resolveOperationalOwnerReferenceIssue(
    bundleOwner,
    ownershipReferenceCatalog,
  )
  const bundleHasOwner = hasOperationalOwnerValue(bundleOwner)
  const ownershipCoverage = {
    bundleDefaultConfigured: bundleHasOwner,
    totalFinalNodes: 0,
    effectiveFinalNodes: 0,
    missingFinalNodes: 0,
    invalidOverrides: 0,
  }

  if (!bundleHasOwner) {
    issues.push({
      severity: 'error',
      code: 'bundle_without_default_owner',
      nodeId: '',
      message: 'Bundle sem responsavel operacional padrao.',
      blocksImport: true,
      blocksPublish: true,
    })
  }

  if (bundleOwnerReferenceIssue) {
    issues.push({
      severity: 'error',
      code: 'bundle_invalid_owner_reference',
      nodeId: '',
      field: bundleOwnerReferenceIssue.field,
      message: bundleOwnerReferenceIssue.message,
      blocksImport: true,
      blocksPublish: true,
    })
  }

  for (const node of workingNodes) {
    if (!node || typeof node !== 'object') {
      issues.push({
        severity: 'error',
        code: 'invalid_node_entry',
        nodeId: '',
        message: 'Entrada de no invalida no bundle.',
        blocksImport: true,
        blocksPublish: true,
      })
      continue
    }
    if (!node.id || !String(node.id).trim()) {
      issues.push({
        severity: 'error',
        code: 'missing_node_id',
        nodeId: '',
        message: 'No sem ID interno.',
        blocksImport: true,
        blocksPublish: true,
      })
      continue
    }

    if (!nodeById.has(node.id)) {
      nodeById.set(node.id, node)
    }

    if (seenNodeIds.has(node.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_node_id',
        nodeId: node.id,
        message: `ID duplicado: ${node.id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }
    seenNodeIds.add(node.id)

    if (!String(node.titulo_exibido || '').trim()) {
      issues.push({
        severity: 'error',
        code: 'missing_short_title',
        nodeId: node.id,
        message: 'No sem titulo curto.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!String(node.tema || '').trim() || !String(node.subtema || '').trim()) {
      issues.push({
        severity: 'error',
        code: 'missing_theme_or_subtheme',
        nodeId: node.id,
        message: 'No sem tema/subtema.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!hasCatalogValue(ACTION_CATALOG, node.acao)) {
      issues.push({
        severity: 'error',
        code: 'invalid_action',
        nodeId: node.id,
        message: `Acao invalida em ${node.id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!hasCatalogValue(QUEUE_DESTINATION_CATALOG, node.fila_destino)) {
      issues.push({
        severity: 'error',
        code: 'invalid_queue_destination',
        nodeId: node.id,
        message: `Fila destino invalida em ${node.id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!hasCatalogValue(CRITICALITY_CATALOG, node.criticidade_padrao)) {
      issues.push({
        severity: 'error',
        code: 'invalid_criticality',
        nodeId: node.id,
        message: `Criticidade invalida em ${node.id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!hasCatalogValue(SLA_CATALOG, node.sla_padrao)) {
      issues.push({
        severity: 'error',
        code: 'invalid_sla',
        nodeId: node.id,
        message: `SLA invalido em ${node.id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    const nodeMode = inferNodeMode(node)
    const outgoingCount = (outgoingMap.get(node.id) || []).length
    const incomingCount = (incomingMap.get(node.id) || []).length
    const ownershipConfig = getNodeOwnershipConfig(node, {
      faqType: targetBundle.tipo_faq,
      fallbackQueue: bundleOwner.queueKey,
    })
    syncNodeOwnershipFields(node, ownershipConfig)

    if (nodeMode === NODE_MODE_MAP.final && !String(node.resposta || '').trim()) {
      issues.push({
        severity: 'error',
        code: 'final_without_response',
        nodeId: node.id,
        message: 'No final sem conteudo de resposta.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (nodeMode === NODE_MODE_MAP.final && outgoingCount > 0) {
      issues.push({
        severity: 'error',
        code: 'final_with_children',
        nodeId: node.id,
        message: 'No final com filhos conectados.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (nodeMode === NODE_MODE_MAP.path && outgoingCount === 0) {
      issues.push({
        severity: 'error',
        code: 'path_without_continuation',
        nodeId: node.id,
        message: 'No de caminho sem continuidade util.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (incomingCount === 0 && outgoingCount === 0) {
      issues.push({
        severity: 'error',
        code: 'orphan_node',
        nodeId: node.id,
        message: 'No orfao sem conexao valida.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!ownershipConfig.inherit && !hasOperationalOwnerValue(ownershipConfig.operationalOwner)) {
      ownershipCoverage.invalidOverrides += 1
      issues.push({
        severity: 'error',
        code: 'invalid_owner_override',
        nodeId: node.id,
        message:
          'Override de ownership invalido. Informe fila, area ou role valido, ou volte para heranca.',
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!ownershipConfig.inherit) {
      const ownerReferenceIssue = resolveOperationalOwnerReferenceIssue(
        ownershipConfig.operationalOwner,
        ownershipReferenceCatalog,
      )
      if (ownerReferenceIssue) {
        ownershipCoverage.invalidOverrides += 1
        issues.push({
          severity: 'error',
          code: 'invalid_owner_reference',
          nodeId: node.id,
          field: ownerReferenceIssue.field,
          message: ownerReferenceIssue.message,
          blocksImport: true,
          blocksPublish: true,
        })
      }
    }
  }

  for (const link of workingLinks) {
    if (!link || typeof link !== 'object') {
      issues.push({
        severity: 'error',
        code: 'invalid_link_entry',
        nodeId: '',
        message: 'Entrada de link invalida no bundle.',
        blocksImport: true,
        blocksPublish: true,
      })
      continue
    }
    if (!link.link_id || !String(link.link_id).trim()) {
      issues.push({
        severity: 'error',
        code: 'missing_link_id',
        nodeId: link.parent_node_id || '',
        message: 'Link sem ID.',
        blocksImport: true,
        blocksPublish: true,
      })
      continue
    }

    if (seenLinkIds.has(link.link_id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_link_id',
        nodeId: link.parent_node_id || '',
        message: `Link duplicado: ${link.link_id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }
    seenLinkIds.add(link.link_id)

    if (!nodeById.has(link.parent_node_id)) {
      issues.push({
        severity: 'error',
        code: 'missing_parent_node',
        nodeId: link.child_node_id || '',
        message: `Pai inexistente: ${link.parent_node_id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (!nodeById.has(link.child_node_id)) {
      issues.push({
        severity: 'error',
        code: 'missing_child_node',
        nodeId: link.parent_node_id || '',
        message: `Filho inexistente: ${link.child_node_id}.`,
        blocksImport: true,
        blocksPublish: true,
      })
    }

    if (link.parent_node_id === link.child_node_id) {
      issues.push({
        severity: 'error',
        code: 'self_reference',
        nodeId: link.parent_node_id,
        message: 'Auto-referencia invalida.',
        blocksImport: true,
        blocksPublish: true,
      })
    }
  }

  for (const [nodeId, incomingLinks] of incomingMap.entries()) {
    if (incomingLinks.length > 1) {
      issues.push({
        severity: 'error',
        code: 'multiple_parents',
        nodeId,
        message: 'No com mais de um pai ativo.',
        blocksImport: true,
        blocksPublish: true,
      })
    }
  }

  const cycleNodeIds = detectCycles(validWorkingNodes, workingLinks)
  if (cycleNodeIds.length) {
    for (const nodeId of cycleNodeIds) {
      issues.push({
        severity: 'error',
        code: 'cycle_detected',
        nodeId,
        message: 'Loop estrutural detectado.',
        blocksImport: true,
        blocksPublish: true,
      })
    }
  }

  if (!workingNodes.length) {
    issues.push({
      severity: 'error',
      code: 'empty_bundle',
      nodeId: '',
      message: 'Fluxo vazio: nenhum no definido.',
      blocksImport: mode === 'import',
      blocksPublish: true,
    })
  }

  for (const node of validWorkingNodes) {
    if (inferNodeMode(node) !== NODE_MODE_MAP.final) {
      continue
    }
    ownershipCoverage.totalFinalNodes += 1
    const effectiveOwner = resolveNodeEffectiveOwner(
      node.id,
      nodeById,
      parentMap,
      bundleOwner,
    )
    if (!effectiveOwner.owner || !hasOperationalOwnerValue(effectiveOwner.owner)) {
      ownershipCoverage.missingFinalNodes += 1
      issues.push({
        severity: 'error',
        code: 'final_without_effective_owner',
        nodeId: node.id,
        message:
          'No final sem responsavel operacional efetivo (bundle + heranca + override).',
        blocksImport: true,
        blocksPublish: true,
      })
    } else {
      const effectiveOwnerReferenceIssue = resolveOperationalOwnerReferenceIssue(
        effectiveOwner.owner,
        ownershipReferenceCatalog,
      )
      if (effectiveOwnerReferenceIssue) {
        ownershipCoverage.missingFinalNodes += 1
        issues.push({
          severity: 'error',
          code: 'final_with_invalid_owner_reference',
          nodeId: node.id,
          field: effectiveOwnerReferenceIssue.field,
          message: `${effectiveOwnerReferenceIssue.message} Corrija bundle/heranca/override antes de publicar.`,
          blocksImport: true,
          blocksPublish: true,
        })
        continue
      }
      ownershipCoverage.effectiveFinalNodes += 1
      node.effective_owner = {
        source: effectiveOwner.source,
        sourceNodeId: effectiveOwner.sourceNodeId,
        ownerType: effectiveOwner.owner.ownerType,
        queueKey: effectiveOwner.owner.queueKey,
        areaLabel: effectiveOwner.owner.areaLabel,
        roleKey: effectiveOwner.owner.roleKey,
        ownerKey: effectiveOwner.owner.ownerKey,
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const nodeIssueSummary = buildNodeValidationIssueSummary(issues)
  const hasBlockingImportError = errors.some((issue) => issue.blocksImport)
  const hasBlockingPublishError = errors.some((issue) => issue.blocksPublish)

  return {
    issues,
    errors,
    warnings,
    nodeIssueSummary,
    ownershipCoverage,
    hasBlockingImportError,
    hasBlockingPublishError,
  }
}

export function buildAutoLayoutSnapshot(bundle = {}, existingSnapshot = {}, options = {}) {
  ensureBundleCollections(bundle)
  const safeNodes = (bundle.nodes || []).filter(
    (node) => node && typeof node === 'object' && String(node.id || '').trim(),
  )
  const safeLinks = (bundle.links || []).filter(
    (link) =>
      link &&
      typeof link === 'object' &&
      String(link.parent_node_id || '').trim() &&
      String(link.child_node_id || '').trim(),
  )
  const rankdir = options.direction || 'TB'
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({
    rankdir,
    ranksep: 90,
    nodesep: 48,
    marginx: 24,
    marginy: 24,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of safeNodes) {
    graph.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    })
  }

  for (const link of safeLinks) {
    if (link.ativo === false) {
      continue
    }
    if (!graph.hasNode(link.parent_node_id) || !graph.hasNode(link.child_node_id)) {
      continue
    }
    graph.setEdge(link.parent_node_id, link.child_node_id)
  }

  dagre.layout(graph)

  const nodePositions = {}
  for (const node of safeNodes) {
    const layoutNode = graph.node(node.id)
    if (layoutNode) {
      nodePositions[node.id] = {
        x: Math.round(layoutNode.x - DEFAULT_NODE_WIDTH / 2),
        y: Math.round(layoutNode.y - DEFAULT_NODE_HEIGHT / 2),
      }
    } else {
      nodePositions[node.id] = {
        x: 80,
        y: 80,
      }
    }
  }

  return {
    ...cloneJson(DEFAULT_CANVAS_SNAPSHOT),
    ...(existingSnapshot || {}),
    nodePositions,
    edges: safeLinks
      .filter((link) => link.ativo !== false)
      .map((link) => ({
        id:
          String(link.link_id || '').trim() ||
          buildLinkId(
            String(link.parent_node_id || '').trim(),
            String(link.child_node_id || '').trim(),
          ),
        source: String(link.parent_node_id || '').trim(),
        target: String(link.child_node_id || '').trim(),
      })),
    updatedAt: nowIso(),
  }
}

export function buildFaqBuilderGraph(bundle = {}, canvasSnapshot = {}, validation = null) {
  ensureBundleCollections(bundle)
  const safeNodes = (bundle.nodes || []).filter(
    (node) => node && typeof node === 'object' && String(node.id || '').trim(),
  )
  const safeLinks = (bundle.links || []).filter(
    (link) =>
      link &&
      typeof link === 'object' &&
      String(link.parent_node_id || '').trim() &&
      String(link.child_node_id || '').trim(),
  )
  const issueSummary = validation?.nodeIssueSummary || new Map()
  const snapshotPositions = canvasSnapshot?.nodePositions || {}
  const nodes = safeNodes.map((node) => {
    const summary = issueSummary.get(node.id) || null
    const nodeMode = inferNodeMode(node)

    return {
      id: node.id,
      type: 'faqBuilderNode',
      position: snapshotPositions[node.id] || { x: 80, y: 80 },
      draggable: true,
      selectable: true,
      data: {
        title: node.titulo_exibido || node.id,
        subtitle: `${titleCase(node.tema)} / ${titleCase(node.subtema)}`,
        nodeMode,
        action: node.acao,
        queueDestination: node.fila_destino,
        ownershipMode: node.owner_inherit ? 'inherit' : 'override',
        ownerQueue: node.owner_queue || node.effective_owner?.queueKey || '',
        ownerArea: node.owner_area || node.effective_owner?.areaLabel || '',
        ownerRole: node.owner_role || node.effective_owner?.roleKey || '',
        status: node.publication_status || 'draft',
        issueCount: summary?.count || 0,
        issueSeverity: summary?.hasError ? 'error' : summary?.hasWarning ? 'warning' : 'none',
        issueLabels: summary?.labels || [],
      },
    }
  })

  const edges = safeLinks
    .filter((link) => link.ativo !== false)
    .map((link) => ({
      id:
        String(link.link_id || '').trim() ||
        buildLinkId(
          String(link.parent_node_id || '').trim(),
          String(link.child_node_id || '').trim(),
        ),
      source: String(link.parent_node_id || '').trim(),
      target: String(link.child_node_id || '').trim(),
      label: String(link.ordem || ''),
      type: 'smoothstep',
      animated: false,
      data: {
        order: link.ordem || 0,
      },
    }))

  return {
    nodes,
    edges,
  }
}

export function buildFaqBuilderGraphSafe(
  bundle = {},
  canvasSnapshot = {},
  validation = null,
  options = {},
) {
  const sanity = runFaqBuilderBundleSanityCheck(bundle, canvasSnapshot, options)
  try {
    const graph = buildFaqBuilderGraph(
      sanity.bundle,
      sanity.canvasSnapshot,
      validation,
    )
    return {
      graph,
      sanity,
      fallbackUsed: false,
    }
  } catch (error) {
    return {
      graph: { nodes: [], edges: [] },
      sanity: {
        ...sanity,
        errors: [
          ...(sanity.errors || []),
          {
            code: 'runtime_graph_build_failed',
            message: String(error?.message || 'Falha ao montar o canvas.'),
          },
        ],
      },
      fallbackUsed: true,
    }
  }
}

export function createFaqBuilderWorkspace(faqType = 'aluno', editorName = 'Admin local') {
  const draftBundle = cloneFaqBuilderPackage(faqType)
  const publishedBundle = cloneFaqBuilderPackage(faqType)
  const canvasSnapshot = buildAutoLayoutSnapshot(draftBundle)

  return {
    faqType,
    draftBundle,
    publishedBundle,
    canvasSnapshot,
    publishedCanvasSnapshot: cloneJson(canvasSnapshot),
    workflowStatus: WORKFLOW_STATUS_MAP[draftBundle.versioning?.publication_status || 'draft'] || 'Draft',
    lockContext: {
      editorName,
      acquiredAt: nowIso(),
      lastTouchedAt: nowIso(),
      lockState: 'advisory_lock',
    },
    changeLog: [
      {
        id: `workspace-init-${faqType}`,
        actor: editorName,
        action: 'workspace_initialized',
        at: nowIso(),
        details: `Workspace ${faqType} iniciado em rascunho.`,
      },
    ],
    versionCounter: 1,
    draftRevisionCounter: 1,
    publishConfig: {
      publishMode: 'immediate',
      effectiveStartAt: null,
      effectiveEndAt: null,
      priority: Number(draftBundle.publication?.priority || 50),
      displayRank: Number(draftBundle.publication?.display_rank || 50),
      isFeatured: Boolean(draftBundle.publication?.is_featured),
      conditions: draftBundle.publication?.conditions || '',
    },
    publishedHistory: [],
    activePublishedVersionId: '',
  }
}

export function createFaqBuilderWorkspaceFromBundle(
  bundle = {},
  editorName = 'Admin local',
  options = {},
) {
  const draftBundle = ensureBundleCollections(cloneJson(bundle || {}))
  const publishedBundle = ensureBundleCollections(cloneJson(options.publishedBundle || bundle || {}))
  const draftWithinRenderLimits =
    (draftBundle.nodes?.length || 0) <= FAQ_BUILDER_RUNTIME_GUARDS.maxRenderNodes &&
    (draftBundle.links?.length || 0) <= FAQ_BUILDER_RUNTIME_GUARDS.maxRenderEdges
  const publishedWithinRenderLimits =
    (publishedBundle.nodes?.length || 0) <= FAQ_BUILDER_RUNTIME_GUARDS.maxRenderNodes &&
    (publishedBundle.links?.length || 0) <= FAQ_BUILDER_RUNTIME_GUARDS.maxRenderEdges
  const canvasSnapshot = options.canvasSnapshot
    ? cloneJson(options.canvasSnapshot)
    : draftWithinRenderLimits
      ? buildAutoLayoutSnapshot(draftBundle)
      : sanitizeFaqBuilderCanvasSnapshot({}, draftBundle)
  const publishedCanvasSnapshot = options.publishedCanvasSnapshot
    ? cloneJson(options.publishedCanvasSnapshot)
    : publishedWithinRenderLimits
      ? buildAutoLayoutSnapshot(publishedBundle)
      : sanitizeFaqBuilderCanvasSnapshot({}, publishedBundle)
  const draftStatus =
    WORKFLOW_STATUS_MAP[draftBundle.versioning?.publication_status || 'draft'] || 'Draft'
  const publishConfig = {
    publishMode: options.publishConfig?.publishMode || 'immediate',
    effectiveStartAt:
      options.publishConfig?.effectiveStartAt ??
      draftBundle.publication?.effective_start_at ??
      null,
    effectiveEndAt:
      options.publishConfig?.effectiveEndAt ??
      draftBundle.publication?.effective_end_at ??
      null,
    priority: Number(
      options.publishConfig?.priority ??
        draftBundle.publication?.priority ??
        50,
    ),
    displayRank: Number(
      options.publishConfig?.displayRank ??
        draftBundle.publication?.display_rank ??
        50,
    ),
    isFeatured: Boolean(
      options.publishConfig?.isFeatured ??
        draftBundle.publication?.is_featured ??
        false,
    ),
    conditions:
      options.publishConfig?.conditions ??
      draftBundle.publication?.conditions ??
      '',
  }

  return {
    faqType: draftBundle.tipo_faq || options.faqType || 'aluno',
    draftBundle,
    publishedBundle,
    canvasSnapshot,
    publishedCanvasSnapshot,
    workflowStatus: options.workflowStatus || draftStatus,
    lockContext: {
      editorName,
      acquiredAt: options.lockContext?.acquiredAt || nowIso(),
      lastTouchedAt: options.lockContext?.lastTouchedAt || nowIso(),
      lockState: options.lockContext?.lockState || 'advisory_lock',
    },
    changeLog: Array.isArray(options.changeLog)
      ? cloneJson(options.changeLog)
      : [
          {
            id: `workspace-init-${Date.now()}`,
            actor: editorName,
            action: 'workspace_initialized',
            at: nowIso(),
            details: `Workspace ${draftBundle.metadata?.title || draftBundle.faq_id || ''} iniciado.`,
          },
        ],
    versionCounter: Number(options.versionCounter || 1),
    draftRevisionCounter: Number(options.draftRevisionCounter || 1),
    publishConfig,
    publishedHistory: Array.isArray(options.publishedHistory)
      ? cloneJson(options.publishedHistory)
      : [],
    activePublishedVersionId:
      options.activePublishedVersionId ||
      draftBundle.publication?.active_bundle_version_id ||
      '',
  }
}

function buildBundleId(faqType = 'aluno', subjectKey = 'geral') {
  return `bundle:${faqType}:${slugify(subjectKey) || 'geral'}`
}

function collectReachableNodeIds(rootNodeId = '', links = []) {
  const outgoingMap = buildOutgoingMap(links)
  const visited = new Set()
  const stack = [rootNodeId]

  while (stack.length) {
    const currentId = stack.pop()
    if (!currentId || visited.has(currentId)) {
      continue
    }
    visited.add(currentId)

    const outgoing = outgoingMap.get(currentId) || []
    for (const link of outgoing) {
      if (!visited.has(link.child_node_id)) {
        stack.push(link.child_node_id)
      }
    }
  }

  return visited
}

function createBundleFromRootNode(faqPackage = {}, rootNode = {}, index = 1) {
  ensureBundleCollections(faqPackage)
  const faqType = faqPackage.tipo_faq || 'aluno'
  const subjectKey = slugify(rootNode.tema || rootNode.id || `tema-${index}`) || `tema-${index}`
  const bundleId = buildBundleId(faqType, subjectKey)
  const nodeIds = collectReachableNodeIds(rootNode.id, faqPackage.links || [])
  const nodes = (faqPackage.nodes || [])
    .filter((node) => nodeIds.has(node.id))
    .map((node) => cloneJson(node))
  const links = (faqPackage.links || [])
    .filter(
      (link) =>
        link.ativo !== false &&
        nodeIds.has(link.parent_node_id) &&
        nodeIds.has(link.child_node_id),
    )
    .map((link) => cloneJson(link))
  const highlights = (faqPackage.calendar_highlights || [])
    .filter((highlight) => {
      if (highlight.target_type === 'tema') {
        return normalizeText(highlight.target_value) === normalizeText(rootNode.tema)
      }
      if (highlight.target_type === 'node') {
        return nodeIds.has(highlight.target_id)
      }
      return false
    })
    .map((highlight) => cloneJson(highlight))

  const faqId = `${faqPackage.faq_id || `faq-${faqType}`}:${subjectKey}`
  const bundle = ensureBundleCollections({
    ...cloneJson(faqPackage),
    faq_id: faqId,
    tipo_faq: faqType,
    metadata: {
      ...(cloneJson(faqPackage.metadata || {})),
      title: rootNode.titulo_exibido || titleCase(rootNode.tema || subjectKey),
      subject_key: subjectKey,
      bundle_id: bundleId,
      source_scope: 'bundle',
    },
    nodes,
    links,
    calendar_highlights: highlights,
  })

  bundle.versioning = {
    ...(cloneJson(faqPackage.versioning || {})),
    publication_status: bundle.versioning?.publication_status || 'draft',
  }

  return {
    bundleId,
    faqType,
    subjectKey,
    title: bundle.metadata?.title || titleCase(subjectKey),
    description:
      rootNode.descricao_interna ||
      `Fluxo dedicado para ${titleCase(rootNode.tema || subjectKey)}.`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: 'seed_runtime',
    updatedBy: 'seed_runtime',
    workspace: createFaqBuilderWorkspaceFromBundle(bundle, 'Admin local', {
      versionCounter: 1,
    }),
  }
}

function buildSeedBundleEntries() {
  const entries = []
  for (const faqType of ['aluno', 'op']) {
    const faqPackage = cloneFaqBuilderPackage(faqType)
    const roots = collectValidNodes(faqPackage.nodes).filter(
      (node) => node.node_kind === 'theme' && node.ativo !== false,
    )

    roots.forEach((rootNode, index) => {
      entries.push(createBundleFromRootNode(faqPackage, rootNode, index + 1))
    })
  }
  return entries
}

function normalizeLibraryPayload(payload = {}, editorName = 'Admin local') {
  const bundles = Array.isArray(payload.bundles) ? payload.bundles : []
  return {
    schemaVersion: payload.schemaVersion || 'faq-builder-library-v1',
    updatedAt: payload.updatedAt || nowIso(),
    bundles: bundles
      .map((entry) => {
        if (!entry?.bundleId) {
          return null
        }

        const workspace = createFaqBuilderWorkspaceFromBundle(
          entry.workspace?.draftBundle || {},
          editorName,
          {
            faqType: entry.faqType,
            publishedBundle: entry.workspace?.publishedBundle || entry.workspace?.draftBundle || {},
            canvasSnapshot: entry.workspace?.canvasSnapshot || null,
            publishedCanvasSnapshot: entry.workspace?.publishedCanvasSnapshot || null,
            workflowStatus: entry.workspace?.workflowStatus || 'Draft',
            lockContext: entry.workspace?.lockContext || {},
            changeLog: entry.workspace?.changeLog || [],
            versionCounter: entry.workspace?.versionCounter || 1,
            draftRevisionCounter: entry.workspace?.draftRevisionCounter || 1,
            publishConfig: entry.workspace?.publishConfig || null,
            publishedHistory: entry.workspace?.publishedHistory || [],
            activePublishedVersionId: entry.workspace?.activePublishedVersionId || '',
          },
        )

        return {
          bundleId: entry.bundleId,
          faqType: entry.faqType || workspace.faqType || 'aluno',
          subjectKey: entry.subjectKey || workspace.draftBundle.metadata?.subject_key || 'geral',
          title: entry.title || workspace.draftBundle.metadata?.title || 'Fluxo sem titulo',
          description: entry.description || '',
          createdAt: entry.createdAt || nowIso(),
          updatedAt: entry.updatedAt || nowIso(),
          createdBy: entry.createdBy || editorName,
          updatedBy: entry.updatedBy || editorName,
          workspace,
        }
      })
      .filter(Boolean),
  }
}

export function createFaqBuilderBundleLibrary(editorName = 'Admin local') {
  return normalizeLibraryPayload(
    {
      schemaVersion: 'faq-builder-library-v1',
      updatedAt: nowIso(),
      bundles: buildSeedBundleEntries(),
    },
    editorName,
  )
}

export function loadFaqBuilderBundleLibraryLocal(editorName = 'Admin local') {
  if (typeof window === 'undefined') {
    return createFaqBuilderBundleLibrary(editorName)
  }

  const rawValue = readLocalStorageItem(FAQ_BUILDER_LIBRARY_STORAGE_KEY)
  if (!rawValue) {
    const seeded = createFaqBuilderBundleLibrary(editorName)
    saveFaqBuilderBundleLibraryLocal(seeded)
    return seeded
  }

  if (rawValue.length > FAQ_BUILDER_LIBRARY_MAX_SIZE_BYTES) {
    const seeded = createFaqBuilderBundleLibrary(editorName)
    saveFaqBuilderBundleLibraryLocal(seeded)
    console.warn(
      '[faq-builder] Biblioteca local excedeu limite seguro e foi reinicializada.',
      {
        rawSizeBytes: rawValue.length,
        maxAllowedBytes: FAQ_BUILDER_LIBRARY_MAX_SIZE_BYTES,
      },
    )
    return seeded
  }

  try {
    return normalizeLibraryPayload(JSON.parse(rawValue), editorName)
  } catch {
    const seeded = createFaqBuilderBundleLibrary(editorName)
    saveFaqBuilderBundleLibraryLocal(seeded)
    return seeded
  }
}

export function saveFaqBuilderBundleLibraryLocal(library = {}, options = {}) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const payload = options.skipNormalize
      ? cloneJson(library || {})
      : normalizeLibraryPayload(
          library,
          library?.bundles?.[0]?.updatedBy || 'Admin local',
        )

    payload.schemaVersion = payload.schemaVersion || 'faq-builder-library-v1'
    payload.bundles = Array.isArray(payload.bundles) ? payload.bundles : []
    payload.updatedAt = nowIso()

    const serialized = JSON.stringify(payload)
    if (serialized.length > FAQ_BUILDER_LIBRARY_MAX_SIZE_BYTES) {
      console.warn(
        '[faq-builder] Salvamento local ignorado por exceder limite seguro.',
        {
          payloadSizeBytes: serialized.length,
          maxAllowedBytes: FAQ_BUILDER_LIBRARY_MAX_SIZE_BYTES,
        },
      )
      return
    }
    writeLocalStorageItem(FAQ_BUILDER_LIBRARY_STORAGE_KEY, serialized)
  } catch (error) {
    console.warn('[faq-builder] Falha ao persistir biblioteca local.', error)
  }
}

export function clearFaqBuilderBundleLibraryLocal() {
  if (typeof window === 'undefined') {
    return
  }
  removeLocalStorageItem(FAQ_BUILDER_LIBRARY_STORAGE_KEY)
}

export function getFaqBuilderBundleById(library = {}, bundleId = '') {
  return (library.bundles || []).find((entry) => entry.bundleId === bundleId) || null
}

export function listFaqBuilderBundles(
  library = {},
  { search = '', status = 'all', faqType = 'all', includeValidation = true } = {},
) {
  const query = normalizeText(search)
  const statusQuery = normalizeText(status)
  const faqTypeQuery = normalizeText(faqType)
  return (library.bundles || [])
    .map((entry) => {
      try {
        const cachedValidation = entry?.workspace?.validationSnapshot || {}
        const validation = includeValidation
          ? validateFaqBuilderBundle(entry?.workspace?.draftBundle || {}, {
              mutateInput: false,
            })
          : {
              errors: [],
              warnings: [],
              hasBlockingPublishError: Boolean(cachedValidation.hasBlockingPublishError),
              ownershipCoverage: cachedValidation.ownershipCoverage || {
                bundleDefaultConfigured: false,
                totalFinalNodes: 0,
                effectiveFinalNodes: 0,
                missingFinalNodes: 0,
                invalidOverrides: 0,
              },
              ...cachedValidation,
            }
        const bundleOwner = normalizeOperationalOwner(
          entry?.workspace?.draftBundle?.operational_owner ||
            entry?.workspace?.draftBundle?.metadata?.operational_owner ||
            {},
          {
            faqType: entry?.workspace?.draftBundle?.tipo_faq || entry?.faqType || 'aluno',
          },
        )
        const ownershipCoverage = validation.ownershipCoverage || {
          bundleDefaultConfigured: false,
          totalFinalNodes: 0,
          effectiveFinalNodes: 0,
          missingFinalNodes: 0,
          invalidOverrides: 0,
        }
        const workflowStatus = entry?.workspace?.workflowStatus || 'Draft'
        const statusKey = normalizeText(workflowStatus)
        const nodeCount = entry?.workspace?.draftBundle?.nodes?.length || 0
        return {
          bundleId: entry?.bundleId || '',
          title: entry?.title || 'Fluxo sem titulo',
          description: entry?.description || '',
          faqType: entry?.faqType || 'aluno',
          subjectKey: entry?.subjectKey || 'geral',
          workflowStatus,
          statusKey,
          nodeCount,
          linkCount: entry?.workspace?.draftBundle?.links?.length || 0,
          updatedAt: entry?.workspace?.lockContext?.lastTouchedAt || entry?.updatedAt || nowIso(),
          updatedBy: entry?.workspace?.lockContext?.editorName || entry?.updatedBy || 'Admin local',
          publishedVersion:
            entry?.workspace?.draftBundle?.versioning?.published_version ||
            entry?.workspace?.publishedBundle?.versioning?.published_version ||
            '-',
          validationErrors: validation.errors.length,
          validationWarnings: validation.warnings.length,
          hasBlockingError: validation.hasBlockingPublishError,
          priority:
            Number(entry?.workspace?.publishConfig?.priority ?? entry?.workspace?.draftBundle?.publication?.priority ?? 50),
          isFeatured:
            Boolean(entry?.workspace?.publishConfig?.isFeatured ?? entry?.workspace?.draftBundle?.publication?.is_featured),
          effectiveStartAt:
            entry?.workspace?.publishConfig?.effectiveStartAt ??
            entry?.workspace?.draftBundle?.publication?.effective_start_at ??
            null,
          effectiveEndAt:
            entry?.workspace?.publishConfig?.effectiveEndAt ??
            entry?.workspace?.draftBundle?.publication?.effective_end_at ??
            null,
          activePublishedVersionId:
            entry?.workspace?.activePublishedVersionId ||
            entry?.workspace?.draftBundle?.publication?.active_bundle_version_id ||
            '',
          bundleOwnerType: bundleOwner.ownerType,
          bundleOwnerLabel: formatOperationalOwnerLabel(bundleOwner),
          ownershipCoverageLabel:
            ownershipCoverage.totalFinalNodes > 0
              ? `${ownershipCoverage.effectiveFinalNodes}/${ownershipCoverage.totalFinalNodes}`
              : '0/0',
          ownershipMissingFinalNodes: Number(ownershipCoverage.missingFinalNodes || 0),
          ownershipInvalidOverrides: Number(ownershipCoverage.invalidOverrides || 0),
          hasOwnershipGap:
            !ownershipCoverage.bundleDefaultConfigured ||
            Number(ownershipCoverage.missingFinalNodes || 0) > 0 ||
            Number(ownershipCoverage.invalidOverrides || 0) > 0,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .filter((entry) => {
      if (faqTypeQuery !== 'all' && normalizeText(entry.faqType) !== faqTypeQuery) {
        return false
      }
      if (statusQuery !== 'all' && entry.statusKey !== statusQuery) {
        return false
      }
      if (!query) {
        return true
      }
      const haystack = `${entry.title} ${entry.subjectKey} ${entry.description} ${entry.faqType}`
      return normalizeText(haystack).includes(query)
    })
    .sort((left, right) => {
      if (left.hasBlockingError !== right.hasBlockingError) {
        return left.hasBlockingError ? -1 : 1
      }
      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
    })
}

function buildBundleSkeletonPackage({ faqType = 'aluno', subjectKey = '', title = '' } = {}) {
  const normalizedSubject = slugify(subjectKey || title || 'novo_fluxo') || 'novo_fluxo'
  const bundleFaqId = `faq-${faqType}:${normalizedSubject}`
  const rootId = `${bundleFaqId}-tema`
  const leafId = `${bundleFaqId}-resposta`
  const nowVersion = `draft-${Date.now()}`
  const defaultOwnerQueue = resolveDefaultQueueByFaqType(faqType)

  return ensureBundleCollections({
    schema_version: '2.0.0',
    faq_id: bundleFaqId,
    tipo_faq: faqType,
    metadata: {
      title: title || titleCase(normalizedSubject),
      owner: 'Administracao local',
      source_mode: 'builder',
      supports_unlimited_depth: true,
      supports_calendar_highlights: true,
      subject_key: normalizedSubject,
    },
    versioning: {
      draft_version: nowVersion,
      published_version: '',
      publication_status: 'draft',
      change_summary: 'Fluxo criado no builder.',
      import_source: 'builder',
      base_version: '',
    },
    publication: {
      can_publish: true,
      last_published_at: null,
      last_published_by: '',
      next_review_at: null,
      effective_start_at: null,
      effective_end_at: null,
      priority: 50,
      display_rank: 50,
      is_featured: false,
      conditions: '',
      active_bundle_version_id: '',
      supersedes_version_id: '',
    },
    operational_owner: {
      ownerType: OPERATIONAL_OWNER_TYPE.queue,
      queueKey: defaultOwnerQueue,
      areaLabel: '',
      roleKey: '',
      routingPolicy: 'balancear_por_carga',
      fallbackNote: '',
      ownerKey: `queue:${defaultOwnerQueue}`,
    },
    nodes: [
      {
        id: rootId,
        tipo_faq: faqType,
        perfil: faqType === 'op' ? 'op' : 'aluno',
        node_kind: 'theme',
        tema: normalizedSubject,
        subtema: 'geral',
        titulo_exibido: title || `Fluxo ${titleCase(normalizedSubject)}`,
        pergunta_exibida: 'Qual caminho voce deseja seguir?',
        descricao_interna: 'No inicial do fluxo.',
        resposta: '',
        acao: 'ir_para_subniveis',
        abre_atendimento: false,
        fila_destino: defaultOwnerQueue,
        criticidade_padrao: 'media',
        sla_padrao: '48h',
        ativo: true,
        ordem: 1,
        permite_anexo: false,
        campos_exigidos: [],
        palavras_chave: [normalizedSubject],
        tags: ['novo_fluxo'],
        publication_status: 'draft',
        node_version: nowVersion,
        destaque_home: false,
        prioridade_dinamica: 50,
        builder_editable: true,
        spreadsheet_editable: true,
        ownership: {
          inherit: true,
          ownerType: OPERATIONAL_OWNER_TYPE.queue,
          queueKey: '',
          areaLabel: '',
          roleKey: '',
          routingPolicy: '',
          fallbackNote: '',
          ownerKey: '',
        },
      },
      {
        id: leafId,
        tipo_faq: faqType,
        perfil: faqType === 'op' ? 'op' : 'aluno',
        node_kind: 'leaf',
        tema: normalizedSubject,
        subtema: 'resposta_inicial',
        titulo_exibido: 'Resposta inicial',
        pergunta_exibida: 'Resposta inicial',
        descricao_interna: 'No final inicial para comecar a edicao.',
        resposta: 'Edite esta resposta para publicar o fluxo.',
        acao: 'mostrar_resposta',
        abre_atendimento: false,
        fila_destino: defaultOwnerQueue,
        criticidade_padrao: 'media',
        sla_padrao: '48h',
        ativo: true,
        ordem: 1,
        permite_anexo: false,
        campos_exigidos: [],
        palavras_chave: [],
        tags: ['inicio'],
        publication_status: 'draft',
        node_version: nowVersion,
        destaque_home: false,
        prioridade_dinamica: 50,
        builder_editable: true,
        spreadsheet_editable: true,
        ownership: {
          inherit: true,
          ownerType: OPERATIONAL_OWNER_TYPE.queue,
          queueKey: '',
          areaLabel: '',
          roleKey: '',
          routingPolicy: '',
          fallbackNote: '',
          ownerKey: '',
        },
      },
    ],
    links: [
      {
        link_id: buildLinkId(rootId, leafId),
        faq_id: bundleFaqId,
        parent_node_id: rootId,
        child_node_id: leafId,
        ordem: 1,
        ativo: true,
      },
    ],
    calendar_highlights: [],
  })
}

export function createFaqBuilderBundleEntry(
  library = {},
  {
    faqType = 'aluno',
    title = '',
    subjectKey = '',
    actorName = 'Admin local',
  } = {},
) {
  const normalizedTitle = String(title || '').trim()
  const normalizedSubject = slugify(subjectKey || normalizedTitle || `novo_fluxo_${Date.now()}`)
  const bundleId = buildBundleId(faqType, normalizedSubject)
  if ((library.bundles || []).some((entry) => entry.bundleId === bundleId)) {
    return {
      ok: false,
      message: 'Ja existe um fluxo com esse identificador.',
      bundleId,
    }
  }

  const bundle = buildBundleSkeletonPackage({
    faqType,
    subjectKey: normalizedSubject,
    title: normalizedTitle || `Novo fluxo ${titleCase(normalizedSubject)}`,
  })
  const workspace = createFaqBuilderWorkspaceFromBundle(bundle, actorName, {
    faqType,
    workflowStatus: 'Draft',
  })
  const now = nowIso()
  const newEntry = {
    bundleId,
    faqType,
    subjectKey: normalizedSubject,
    title: bundle.metadata?.title || normalizedTitle,
    description: 'Fluxo criado no builder.',
    createdAt: now,
    updatedAt: now,
    createdBy: actorName,
    updatedBy: actorName,
    workspace,
  }

  library.bundles = Array.isArray(library.bundles) ? library.bundles : []
  library.bundles.unshift(newEntry)
  library.updatedAt = now

  return {
    ok: true,
    entry: newEntry,
  }
}

export function duplicateFaqBuilderBundleEntry(
  library = {},
  bundleId = '',
  actorName = 'Admin local',
) {
  const source = getFaqBuilderBundleById(library, bundleId)
  if (!source) {
    return {
      ok: false,
      message: 'Fluxo de origem nao encontrado.',
    }
  }

  const duplicateSubject = `${source.subjectKey}-copia-${Date.now().toString(36)}`
  const duplicateId = buildBundleId(source.faqType, duplicateSubject)
  const draftBundle = cloneJson(source.workspace?.draftBundle || {})
  draftBundle.faq_id = `${draftBundle.faq_id || `faq-${source.faqType}`}:${duplicateSubject}`
  draftBundle.metadata = draftBundle.metadata || {}
  draftBundle.metadata.subject_key = duplicateSubject
  draftBundle.metadata.title = `${source.title} (copia)`
  draftBundle.versioning = draftBundle.versioning || {}
  draftBundle.versioning.publication_status = 'draft'
  draftBundle.versioning.draft_version = `draft-${Date.now()}`
  draftBundle.versioning.published_version = ''
  draftBundle.versioning.bundle_version_id = ''
  draftBundle.publication = {
    ...(draftBundle.publication || {}),
    last_published_at: null,
    last_published_by: '',
    active_bundle_version_id: '',
    supersedes_version_id: '',
  }

  const now = nowIso()
  const duplicateEntry = {
    bundleId: duplicateId,
    faqType: source.faqType,
    subjectKey: duplicateSubject,
    title: `${source.title} (copia)`,
    description: source.description || '',
    createdAt: now,
    updatedAt: now,
    createdBy: actorName,
    updatedBy: actorName,
    workspace: createFaqBuilderWorkspaceFromBundle(draftBundle, actorName, {
      faqType: source.faqType,
      workflowStatus: 'Draft',
    }),
  }

  library.bundles.unshift(duplicateEntry)
  library.updatedAt = now

  return {
    ok: true,
    entry: duplicateEntry,
  }
}

export function archiveFaqBuilderBundleEntry(
  library = {},
  bundleId = '',
  actorName = 'Admin local',
) {
  const entry = getFaqBuilderBundleById(library, bundleId)
  if (!entry) {
    return {
      ok: false,
      message: 'Fluxo nao encontrado para arquivamento.',
    }
  }

  const transition = transitionFaqBuilderWorkflow(entry.workspace, {
    nextStatus: 'Archived',
    actorName,
    summary: 'Fluxo arquivado pela biblioteca.',
  })
  if (!transition.ok) {
    return transition
  }

  entry.updatedAt = nowIso()
  entry.updatedBy = actorName
  library.updatedAt = nowIso()

  return {
    ok: true,
    entry,
  }
}

export function loadFaqBuilderWorkspaceLocal(faqType = 'aluno', editorName = 'Admin local') {
  if (typeof window === 'undefined') {
    return createFaqBuilderWorkspace(faqType, editorName)
  }

  const storageKey = getWorkspaceStorageKey(faqType)
  const rawValue = readLocalStorageItem(storageKey)
  if (!rawValue) {
    return createFaqBuilderWorkspace(faqType, editorName)
  }

  try {
    const parsed = JSON.parse(rawValue)
    const workspace = {
      ...createFaqBuilderWorkspace(faqType, editorName),
      ...cloneJson(parsed),
    }

    workspace.faqType = faqType
    workspace.draftBundle = ensureBundleCollections(workspace.draftBundle || {})
    workspace.publishedBundle = ensureBundleCollections(workspace.publishedBundle || cloneFaqBuilderPackage(faqType))
    workspace.canvasSnapshot = workspace.canvasSnapshot || buildAutoLayoutSnapshot(workspace.draftBundle)
    workspace.publishedCanvasSnapshot = workspace.publishedCanvasSnapshot || cloneJson(workspace.canvasSnapshot)
    workspace.lockContext = workspace.lockContext || {
      editorName,
      acquiredAt: nowIso(),
      lastTouchedAt: nowIso(),
      lockState: 'advisory_lock',
    }
    workspace.changeLog = Array.isArray(workspace.changeLog) ? workspace.changeLog : []
    workspace.versionCounter = Number(workspace.versionCounter || 1)
    workspace.draftRevisionCounter = Number(workspace.draftRevisionCounter || 1)
    workspace.publishConfig = workspace.publishConfig || {
      publishMode: 'immediate',
      effectiveStartAt: workspace.draftBundle?.publication?.effective_start_at || null,
      effectiveEndAt: workspace.draftBundle?.publication?.effective_end_at || null,
      priority: Number(workspace.draftBundle?.publication?.priority || 50),
      displayRank: Number(workspace.draftBundle?.publication?.display_rank || 50),
      isFeatured: Boolean(workspace.draftBundle?.publication?.is_featured),
      conditions: workspace.draftBundle?.publication?.conditions || '',
    }
    workspace.publishedHistory = Array.isArray(workspace.publishedHistory)
      ? workspace.publishedHistory
      : []
    workspace.activePublishedVersionId =
      workspace.activePublishedVersionId ||
      workspace.draftBundle?.publication?.active_bundle_version_id ||
      ''

    if (!workspace.lockContext.editorName) {
      workspace.lockContext.editorName = editorName
    }
    if (!workspace.lockContext.acquiredAt) {
      workspace.lockContext.acquiredAt = nowIso()
    }
    workspace.lockContext.lastTouchedAt = nowIso()

    return workspace
  } catch {
    return createFaqBuilderWorkspace(faqType, editorName)
  }
}

export function saveFaqBuilderWorkspaceLocal(faqType = 'aluno', workspace = null) {
  if (typeof window === 'undefined' || !workspace) {
    return
  }

  const storageKey = getWorkspaceStorageKey(faqType)
  const payload = cloneJson({
    faqType: workspace.faqType,
    draftBundle: workspace.draftBundle,
    publishedBundle: workspace.publishedBundle,
    canvasSnapshot: workspace.canvasSnapshot,
    publishedCanvasSnapshot: workspace.publishedCanvasSnapshot,
    workflowStatus: workspace.workflowStatus,
    lockContext: workspace.lockContext,
    changeLog: workspace.changeLog,
    versionCounter: workspace.versionCounter,
    draftRevisionCounter: workspace.draftRevisionCounter,
    publishConfig: workspace.publishConfig,
    publishedHistory: workspace.publishedHistory,
    activePublishedVersionId: workspace.activePublishedVersionId,
  })

  writeLocalStorageItem(storageKey, JSON.stringify(payload))
}

export function clearFaqBuilderWorkspaceLocal(faqType = 'aluno') {
  if (typeof window === 'undefined') {
    return
  }
  removeLocalStorageItem(getWorkspaceStorageKey(faqType))
}

export function touchFaqBuilderWorkspace(workspace, actorName = 'Admin local') {
  if (!workspace?.lockContext) {
    return
  }
  workspace.lockContext.editorName = actorName
  workspace.lockContext.lastTouchedAt = nowIso()
}

export function getFaqBuilderNode(bundle = {}, nodeId = '') {
  const nodes = Array.isArray(bundle?.nodes) ? bundle.nodes : []
  const normalizedNodeId = String(nodeId || '').trim()
  if (!normalizedNodeId) {
    return null
  }
  return (
    nodes.find(
      (node) =>
        node &&
        typeof node === 'object' &&
        String(node.id || '').trim() === normalizedNodeId,
    ) || null
  )
}

export function setFaqBuilderNodeField(bundle = {}, nodeId = '', field = '', value = '') {
  const node = getFaqBuilderNode(bundle, nodeId)
  if (!node) {
    return null
  }
  node[field] = value
  return node
}

export function setFaqBuilderNodeListField(bundle = {}, nodeId = '', field = '', rawValue = '') {
  const node = getFaqBuilderNode(bundle, nodeId)
  if (!node) {
    return null
  }

  node[field] = String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return node
}

export function updateCanvasSnapshotNodePosition(snapshot = {}, nodeId = '', position = {}) {
  if (!snapshot.nodePositions) {
    snapshot.nodePositions = {}
  }
  snapshot.nodePositions[nodeId] = {
    x: Math.round(Number(position.x || 0)),
    y: Math.round(Number(position.y || 0)),
  }
  snapshot.updatedAt = nowIso()
}

export function syncCanvasSnapshotEdges(snapshot = {}, bundle = {}) {
  ensureBundleCollections(bundle)
  snapshot.edges = bundle.links
    .filter(
      (link) =>
        link &&
        typeof link === 'object' &&
        link.ativo !== false &&
        String(link.parent_node_id || '').trim() &&
        String(link.child_node_id || '').trim(),
    )
    .map((link) => ({
      id:
        String(link.link_id || '').trim() ||
        buildLinkId(
          String(link.parent_node_id || '').trim(),
          String(link.child_node_id || '').trim(),
        ),
      source: String(link.parent_node_id || '').trim(),
      target: String(link.child_node_id || '').trim(),
    }))
  snapshot.updatedAt = nowIso()
}

export function addFaqBuilderChildNode(bundle = {}, parentNodeId = '', options = {}) {
  ensureBundleCollections(bundle)
  const parentNode = getFaqBuilderNode(bundle, parentNodeId)
  if (!parentNode) {
    return null
  }

  const nodeMode = options.nodeMode || NODE_MODE_MAP.path
  const incomingMap = buildIncomingMap(bundle.links)
  const outgoingMap = buildOutgoingMap(bundle.links)
  const existingIds = new Set(
    collectValidNodes(bundle.nodes).map((node) => String(node.id || '').trim()),
  )
  let sequence = 1
  let candidateId = ''

  while (!candidateId || existingIds.has(candidateId)) {
    candidateId = `faq-${bundle.tipo_faq}-${normalizeText(parentNode.tema || 'tema')}-${Date.now().toString(36)}-${sequence}`
    sequence += 1
  }

  if (inferNodeMode(parentNode) === NODE_MODE_MAP.final) {
    parentNode.node_kind = normalizeNodeKindByMode(NODE_MODE_MAP.path, Boolean(incomingMap.get(parentNode.id)?.length))
    parentNode.acao = 'ir_para_subniveis'
  }

  const newNode = {
    id: candidateId,
    tipo_faq: bundle.tipo_faq,
    perfil: bundle.tipo_faq === 'op' ? 'op' : 'aluno',
    node_kind: normalizeNodeKindByMode(nodeMode, true),
    tema: parentNode.tema || 'novo_tema',
    subtema: parentNode.subtema || 'novo_subtema',
    titulo_exibido: nodeMode === NODE_MODE_MAP.final ? 'Nova resposta final' : 'Novo caminho',
    pergunta_exibida: nodeMode === NODE_MODE_MAP.final ? 'Nova resposta final' : 'Nova pergunta de caminho',
    descricao_interna: '',
    resposta: nodeMode === NODE_MODE_MAP.final ? 'Descreva a resposta final.' : '',
    acao: nodeMode === NODE_MODE_MAP.final ? 'mostrar_resposta' : 'ir_para_subniveis',
    abre_atendimento: false,
    fila_destino:
      parentNode.fila_destino && parentNode.fila_destino !== 'nao_aplicavel'
        ? parentNode.fila_destino
        : bundle.operational_owner?.queueKey || resolveDefaultQueueByFaqType(bundle.tipo_faq),
    criticidade_padrao: parentNode.criticidade_padrao || 'media',
    sla_padrao: parentNode.sla_padrao || '48h',
    ativo: true,
    ordem: nextNodeOrder(outgoingMap, parentNode.id),
    permite_anexo: false,
    campos_exigidos: [],
    palavras_chave: [],
    tags: [],
    publication_status: 'draft',
    node_version: bundle.versioning?.draft_version || '',
    destaque_home: false,
    prioridade_dinamica: 50,
    builder_editable: true,
    spreadsheet_editable: true,
    slug: '',
    ownership: {
      inherit: true,
      ownerType: OPERATIONAL_OWNER_TYPE.queue,
      queueKey: '',
      areaLabel: '',
      roleKey: '',
      routingPolicy: '',
      fallbackNote: '',
      ownerKey: '',
    },
  }

  if (bundle.tipo_faq === 'op') {
    newNode.checklist_op = []
    newNode.sistemas_a_consultar = []
    newNode.documentos_a_solicitar = []
    newNode.resposta_padrao_sugerida = ''
    newNode.criterio_de_escalonamento = ''
    newNode.motivo_escalonamento_sugerido = ''
  }

  syncNodeOwnershipFields(
    newNode,
    getNodeOwnershipConfig(newNode, {
      faqType: bundle.tipo_faq,
      fallbackQueue: bundle.operational_owner?.queueKey || newNode.fila_destino,
    }),
  )

  const newLink = {
    link_id: buildLinkId(parentNode.id, newNode.id),
    faq_id: bundle.faq_id,
    parent_node_id: parentNode.id,
    child_node_id: newNode.id,
    ordem: newNode.ordem,
    ativo: true,
  }

  bundle.nodes.push(newNode)
  bundle.links.push(newLink)
  return newNode
}

export function connectFaqBuilderNodes(bundle = {}, { sourceId = '', targetId = '' } = {}) {
  ensureBundleCollections(bundle)
  if (!sourceId || !targetId) {
    return {
      ok: false,
      message: 'Conexao invalida: origem ou destino vazio.',
    }
  }

  if (sourceId === targetId) {
    return {
      ok: false,
      message: 'Conexao invalida: auto-referencia nao permitida.',
    }
  }

  const sourceNode = getFaqBuilderNode(bundle, sourceId)
  const targetNode = getFaqBuilderNode(bundle, targetId)
  if (!sourceNode || !targetNode) {
    return {
      ok: false,
      message: 'Conexao invalida: no de origem ou destino nao encontrado.',
    }
  }

  const outgoingMap = buildOutgoingMap(bundle.links)
  const incomingMap = buildIncomingMap(bundle.links)
  const existingIncoming = incomingMap.get(targetId) || []

  if (existingIncoming.length > 0) {
    return {
      ok: false,
      message: 'O no destino ja possui pai. Use mover para outro pai.',
    }
  }

  if (inferNodeMode(sourceNode) === NODE_MODE_MAP.final) {
    sourceNode.node_kind = normalizeNodeKindByMode(NODE_MODE_MAP.path, Boolean((incomingMap.get(sourceId) || []).length))
    sourceNode.acao = 'ir_para_subniveis'
  }

  targetNode.node_kind = normalizeNodeKindByMode(inferNodeMode(targetNode), true)
  const newLink = {
    link_id: buildLinkId(sourceId, targetId),
    faq_id: bundle.faq_id,
    parent_node_id: sourceId,
    child_node_id: targetId,
    ordem: nextNodeOrder(outgoingMap, sourceId),
    ativo: true,
  }
  bundle.links.push(newLink)

  const validation = validateFaqBuilderBundle(bundle)
  if (validation.hasBlockingPublishError) {
    bundle.links = bundle.links.filter((link) => link.link_id !== newLink.link_id)
    return {
      ok: false,
      message: 'Conexao bloqueada por inconsistencias estruturais.',
    }
  }

  return {
    ok: true,
    link: newLink,
  }
}

export function moveFaqBuilderNode(bundle = {}, nodeId = '', parentId = '') {
  ensureBundleCollections(bundle)
  const node = getFaqBuilderNode(bundle, nodeId)
  const nextParent = getFaqBuilderNode(bundle, parentId)

  if (!node || !nextParent) {
    return {
      ok: false,
      message: 'Movimento invalido: no ou pai nao encontrado.',
    }
  }

  if (node.id === nextParent.id) {
    return {
      ok: false,
      message: 'Movimento invalido: no nao pode ser pai dele mesmo.',
    }
  }

  const outgoingMap = buildOutgoingMap(bundle.links)
  const descendants = collectDescendants(node.id, outgoingMap, new Set())
  if (descendants.has(parentId)) {
    return {
      ok: false,
      message: 'Movimento invalido: o destino e descendente do no atual.',
    }
  }

  bundle.links = bundle.links.filter((link) => link.child_node_id !== node.id)
  const refreshedOutgoingMap = buildOutgoingMap(bundle.links)
  const newLink = {
    link_id: buildLinkId(parentId, node.id),
    faq_id: bundle.faq_id,
    parent_node_id: parentId,
    child_node_id: node.id,
    ordem: nextNodeOrder(refreshedOutgoingMap, parentId),
    ativo: true,
  }
  bundle.links.push(newLink)
  node.node_kind = normalizeNodeKindByMode(inferNodeMode(node), true)

  return {
    ok: true,
    link: newLink,
  }
}

export function buildFaqBuilderDiff({ draftBundle = {}, publishedBundle = {} } = {}) {
  ensureBundleCollections(draftBundle)
  ensureBundleCollections(publishedBundle)
  const safeDraftNodes = (draftBundle.nodes || []).filter(
    (node) => node && typeof node === 'object' && String(node.id || '').trim(),
  )
  const safePublishedNodes = (publishedBundle.nodes || []).filter(
    (node) => node && typeof node === 'object' && String(node.id || '').trim(),
  )
  const safeDraftLinks = (draftBundle.links || []).filter(
    (link) =>
      link &&
      typeof link === 'object' &&
      link.ativo !== false &&
      String(link.parent_node_id || '').trim() &&
      String(link.child_node_id || '').trim(),
  )
  const safePublishedLinks = (publishedBundle.links || []).filter(
    (link) =>
      link &&
      typeof link === 'object' &&
      link.ativo !== false &&
      String(link.parent_node_id || '').trim() &&
      String(link.child_node_id || '').trim(),
  )

  const draftNodesById = new Map(safeDraftNodes.map((node) => [node.id, node]))
  const publishedNodesById = new Map(safePublishedNodes.map((node) => [node.id, node]))
  const createdNodes = []
  const removedNodes = []
  const updatedNodes = []

  for (const draftNode of safeDraftNodes) {
    const publishedNode = publishedNodesById.get(draftNode.id)
    if (!publishedNode) {
      createdNodes.push(draftNode)
      continue
    }

    const changedFields = []
    for (const field of ['titulo_exibido', 'resposta', 'acao', 'tema', 'subtema', 'node_kind']) {
      if (String(draftNode[field] || '') !== String(publishedNode[field] || '')) {
        changedFields.push(field)
      }
    }

    if (changedFields.length) {
      updatedNodes.push({
        nodeId: draftNode.id,
        title: draftNode.titulo_exibido,
        changedFields,
      })
    }
  }

  for (const publishedNode of safePublishedNodes) {
    if (!draftNodesById.has(publishedNode.id)) {
      removedNodes.push(publishedNode)
    }
  }

  const draftLinks = new Set(
    safeDraftLinks.map(
      (link) => `${link.parent_node_id}->${link.child_node_id}`,
    ),
  )
  const publishedLinks = new Set(
    safePublishedLinks.map(
      (link) => `${link.parent_node_id}->${link.child_node_id}`,
    ),
  )
  const createdLinks = [...draftLinks].filter((item) => !publishedLinks.has(item))
  const removedLinks = [...publishedLinks].filter((item) => !draftLinks.has(item))

  return {
    createdNodes,
    removedNodes,
    updatedNodes,
    createdLinks,
    removedLinks,
    summary: {
      createdNodes: createdNodes.length,
      removedNodes: removedNodes.length,
      updatedNodes: updatedNodes.length,
      createdLinks: createdLinks.length,
      removedLinks: removedLinks.length,
    },
  }
}

export function transitionFaqBuilderWorkflow(workspace = {}, { nextStatus = 'Draft', actorName = 'Admin local', summary = '' } = {}) {
  if (!FAQ_BUILDER_WORKFLOW_OPTIONS.includes(nextStatus)) {
    return {
      ok: false,
      message: 'Status de workflow invalido.',
    }
  }

  workspace.workflowStatus = nextStatus
  workspace.draftBundle.versioning = workspace.draftBundle.versioning || {}
  workspace.draftBundle.versioning.publication_status = WORKFLOW_STATUS_REVERSE[nextStatus] || 'draft'
  workspace.draftBundle.versioning.change_summary = summary || workspace.draftBundle.versioning.change_summary || ''
  workspace.changeLog = Array.isArray(workspace.changeLog) ? workspace.changeLog : []
  workspace.changeLog.unshift({
    id: `workflow-${Date.now()}`,
    actor: actorName,
    action: 'workflow_transition',
    at: nowIso(),
    details: `${nextStatus}${summary ? ` | ${summary}` : ''}`,
  })
  touchFaqBuilderWorkspace(workspace, actorName)
  return {
    ok: true,
  }
}

export function saveFaqBuilderDraftWorkspace(
  workspace = {},
  { actorName = 'Admin local', summary = '' } = {},
) {
  workspace.workflowStatus = 'Draft'
  workspace.draftBundle.versioning = workspace.draftBundle.versioning || {}
  workspace.draftRevisionCounter = Number(workspace.draftRevisionCounter || 1) + 1
  workspace.draftBundle.versioning.publication_status = 'draft'
  workspace.draftBundle.versioning.draft_revision = workspace.draftRevisionCounter
  workspace.draftBundle.versioning.change_summary =
    summary || workspace.draftBundle.versioning.change_summary || ''
  workspace.changeLog = Array.isArray(workspace.changeLog) ? workspace.changeLog : []
  workspace.changeLog.unshift({
    id: `save-draft-${Date.now()}`,
    actor: actorName,
    action: 'save_draft',
    at: nowIso(),
    details: summary || 'Rascunho salvo no editor.',
  })
  touchFaqBuilderWorkspace(workspace, actorName)
  return {
    ok: true,
    draftRevision: workspace.draftRevisionCounter,
  }
}

function normalizePublishConfig(publishConfig = {}, currentDate = new Date()) {
  const effectiveStartAt =
    publishConfig.publishMode === 'scheduled'
      ? publishConfig.effectiveStartAt || null
      : nowIso(currentDate)
  const effectiveEndAt =
    publishConfig.publishMode === 'scheduled'
      ? publishConfig.effectiveEndAt || null
      : publishConfig.effectiveEndAt || null
  return {
    publishMode: publishConfig.publishMode || 'immediate',
    effectiveStartAt,
    effectiveEndAt,
    priority: Number.isFinite(Number(publishConfig.priority))
      ? Number(publishConfig.priority)
      : 50,
    displayRank: Number.isFinite(Number(publishConfig.displayRank))
      ? Number(publishConfig.displayRank)
      : 50,
    isFeatured: Boolean(publishConfig.isFeatured),
    conditions: String(publishConfig.conditions || '').trim(),
  }
}

function validatePublishConfig(config = {}) {
  const startDate = config.effectiveStartAt
    ? new Date(config.effectiveStartAt)
    : null
  const endDate = config.effectiveEndAt ? new Date(config.effectiveEndAt) : null
  if (startDate && Number.isNaN(startDate.getTime())) {
    return 'Data de inicio de vigencia invalida.'
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    return 'Data de encerramento invalida.'
  }
  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    return 'A data de encerramento deve ser maior que a data de inicio.'
  }
  return ''
}

export function buildFaqBuilderPublicationPreview(
  workspace = {},
  { actorName = 'Admin local', currentDate = new Date(), publishConfig = null } = {},
) {
  const config = normalizePublishConfig(
    publishConfig || workspace.publishConfig || {},
    currentDate,
  )
  const currentPublishedVersion =
    workspace.activePublishedVersionId ||
    workspace.draftBundle?.publication?.active_bundle_version_id ||
    ''
  const nextVersionNumber = Number(workspace.versionCounter || 1) + 1
  const nextVersionId = `v${nextVersionNumber}.0`
  return {
    actorName,
    currentPublishedVersion,
    nextVersionId,
    willSupersede: Boolean(currentPublishedVersion),
    ...config,
  }
}

export function publishFaqBuilderWorkspace(
  workspace = {},
  { actorName = 'Admin local', summary = '', publishConfig = null, currentDate = new Date() } = {},
) {
  const validation = validateFaqBuilderBundle(workspace.draftBundle)
  const serverCoverageValidation = validateBundleOwnershipCoverageForServer(validation)
  if (validation.hasBlockingPublishError) {
    const ownershipBlocked = validation.errors.some((issue) =>
      [
        'bundle_without_default_owner',
        'bundle_invalid_owner_reference',
        'final_without_effective_owner',
        'final_with_invalid_owner_reference',
        'invalid_owner_override',
        'invalid_owner_reference',
      ].includes(issue.code),
    )
    return {
      ok: false,
      errorCode: ownershipBlocked
        ? 'PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE'
        : serverCoverageValidation.primaryError?.code || 'BUNDLE_VALIDATION_FAILED',
      message: ownershipBlocked
        ? 'Publicacao bloqueada: existe resposta final sem owner operacional efetivo.'
        : 'Publicacao bloqueada: existem erros estruturais.',
      validation,
      backendValidation: serverCoverageValidation,
    }
  }

  const normalizedPublishConfig = normalizePublishConfig(
    publishConfig || workspace.publishConfig || {},
    currentDate,
  )
  const publishConfigError = validatePublishConfig(normalizedPublishConfig)
  if (publishConfigError) {
    return {
      ok: false,
      message: publishConfigError,
      validation,
    }
  }

  const currentPublishedVersion =
    workspace.activePublishedVersionId ||
    workspace.draftBundle?.publication?.active_bundle_version_id ||
    ''
  workspace.publishedBundle = cloneJson(workspace.draftBundle)
  workspace.publishedCanvasSnapshot = cloneJson(workspace.canvasSnapshot || {})
  workspace.workflowStatus = 'Published'
  workspace.versionCounter = Number(workspace.versionCounter || 1) + 1
  workspace.draftBundle.versioning = workspace.draftBundle.versioning || {}
  workspace.draftBundle.publication = workspace.draftBundle.publication || {}
  workspace.publishConfig = normalizedPublishConfig
  workspace.draftBundle.versioning.publication_status = 'published'
  workspace.draftBundle.versioning.published_version = `v${workspace.versionCounter}.0`
  workspace.draftBundle.versioning.bundle_version_id = workspace.draftBundle.versioning.published_version
  workspace.draftBundle.versioning.change_summary = summary || workspace.draftBundle.versioning.change_summary || ''
  workspace.draftBundle.publication.last_published_at = nowIso(currentDate)
  workspace.draftBundle.publication.last_published_by = actorName
  workspace.draftBundle.publication.can_publish = true
  workspace.draftBundle.publication.effective_start_at = normalizedPublishConfig.effectiveStartAt
  workspace.draftBundle.publication.effective_end_at = normalizedPublishConfig.effectiveEndAt
  workspace.draftBundle.publication.priority = normalizedPublishConfig.priority
  workspace.draftBundle.publication.display_rank = normalizedPublishConfig.displayRank
  workspace.draftBundle.publication.is_featured = normalizedPublishConfig.isFeatured
  workspace.draftBundle.publication.conditions = normalizedPublishConfig.conditions
  workspace.draftBundle.publication.active_bundle_version_id = workspace.draftBundle.versioning.bundle_version_id
  workspace.draftBundle.publication.supersedes_version_id = currentPublishedVersion || ''
  workspace.activePublishedVersionId = workspace.draftBundle.versioning.bundle_version_id
  workspace.publishedHistory = Array.isArray(workspace.publishedHistory)
    ? workspace.publishedHistory
    : []
  workspace.publishedHistory.unshift({
    bundleVersionId: workspace.draftBundle.versioning.bundle_version_id,
    publishedAt: nowIso(currentDate),
    publishedBy: actorName,
    effectiveStartAt: normalizedPublishConfig.effectiveStartAt,
    effectiveEndAt: normalizedPublishConfig.effectiveEndAt,
    priority: normalizedPublishConfig.priority,
    displayRank: normalizedPublishConfig.displayRank,
    isFeatured: normalizedPublishConfig.isFeatured,
    conditions: normalizedPublishConfig.conditions,
    supersedesVersionId: currentPublishedVersion || '',
    changeSummary: summary || workspace.draftBundle.versioning.change_summary || '',
  })
  workspace.changeLog = Array.isArray(workspace.changeLog) ? workspace.changeLog : []
  workspace.changeLog.unshift({
    id: `publish-${Date.now()}`,
    actor: actorName,
    action: 'published',
    at: nowIso(currentDate),
    details: summary || 'Publicacao manual pelo Builder.',
  })
  touchFaqBuilderWorkspace(workspace, actorName)

  return {
    ok: true,
    validation,
    publication: workspace.publishedHistory[0],
    backendValidation: serverCoverageValidation,
  }
}

export function resolveFaqBuilderActivePublishedVersion(
  workspace = {},
  { currentDate = new Date() } = {},
) {
  const publishedHistory = Array.isArray(workspace.publishedHistory)
    ? workspace.publishedHistory
    : []
  if (!publishedHistory.length) {
    return null
  }

  const now = currentDate.getTime()
  const activeCandidates = publishedHistory.filter((item) => {
    const start = item.effectiveStartAt ? new Date(item.effectiveStartAt).getTime() : null
    const end = item.effectiveEndAt ? new Date(item.effectiveEndAt).getTime() : null
    const startOk = start === null || !Number.isNaN(start) ? start === null || start <= now : false
    const endOk = end === null || !Number.isNaN(end) ? end === null || now < end : false
    return startOk && endOk
  })

  if (!activeCandidates.length) {
    return publishedHistory[0]
  }

  return activeCandidates.sort((left, right) => {
    if (Boolean(left.isFeatured) !== Boolean(right.isFeatured)) {
      return left.isFeatured ? -1 : 1
    }
    if (Number(left.priority || 0) !== Number(right.priority || 0)) {
      return Number(right.priority || 0) - Number(left.priority || 0)
    }
    if (Number(left.displayRank || 0) !== Number(right.displayRank || 0)) {
      return Number(left.displayRank || 0) - Number(right.displayRank || 0)
    }
    return new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime()
  })[0]
}

export function startFaqBuilderStudentSession(
  workspace = {},
  {
    actor = 'admin_tester',
    mode = 'draft',
    currentDate = new Date(),
  } = {},
) {
  const activePublished = resolveFaqBuilderActivePublishedVersion(workspace, {
    currentDate,
  })
  const useDraft = mode === 'draft' || !activePublished
  const bundleVersionId = useDraft
    ? workspace.draftBundle?.versioning?.draft_version || 'draft-local'
    : activePublished?.bundleVersionId || workspace.activePublishedVersionId || 'published-unknown'

  return {
    sessionId: `faq-session-${Date.now().toString(36)}`,
    actor,
    mode: useDraft ? 'draft' : 'published',
    bundleVersionId,
    startedAt: nowIso(currentDate),
    bindPolicy: 'sticky_version',
    nonInterruptiveSwitch: true,
  }
}

export function buildFaqBuilderPreviewJourney(bundle = {}, startNodeId = '') {
  const nodes = Array.isArray(bundle?.nodes)
    ? bundle.nodes.filter(
        (node) => node && typeof node === 'object' && String(node.id || '').trim(),
      )
    : []
  const links = Array.isArray(bundle?.links)
    ? bundle.links.filter(
        (link) =>
          link &&
          typeof link === 'object' &&
          String(link.parent_node_id || '').trim() &&
          String(link.child_node_id || '').trim(),
      )
    : []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoingMap = buildOutgoingMap(links)
  const incomingMap = buildIncomingMap(links)
  const rootIds = inferRootIds(nodes, incomingMap)
  const startId = startNodeId && nodeById.has(startNodeId) ? startNodeId : rootIds[0] || ''

  return {
    rootIds,
    startId,
    nodeById,
    outgoingMap,
  }
}

export function buildFaqBuilderPreviewJourneySafe(
  bundle = {},
  startNodeId = '',
  options = {},
) {
  const sanity = runFaqBuilderBundleSanityCheck(
    bundle,
    { nodePositions: {}, edges: [] },
    options,
  )
  try {
    const preview = buildFaqBuilderPreviewJourney(sanity.bundle, startNodeId)
    return {
      ...preview,
      sanity,
      fallbackUsed: false,
    }
  } catch (error) {
    return {
      rootIds: [],
      startId: '',
      nodeById: new Map(),
      outgoingMap: new Map(),
      sanity: {
        ...sanity,
        errors: [
          ...(sanity.errors || []),
          {
            code: 'runtime_preview_build_failed',
            message: String(error?.message || 'Falha ao preparar preview.'),
          },
        ],
      },
      fallbackUsed: true,
    }
  }
}

export function rebuildFaqBuilderCanvasSnapshot(bundle = {}, currentSnapshot = {}) {
  const sanity = runFaqBuilderBundleSanityCheck(bundle, currentSnapshot, {
    mode: 'rebuild_snapshot',
  })
  try {
    return buildAutoLayoutSnapshot(sanity.bundle, sanity.canvasSnapshot)
  } catch {
    return sanitizeFaqBuilderCanvasSnapshot(sanity.canvasSnapshot, sanity.bundle)
  }
}

export async function readFaqBuilderSpreadsheet(file, { faqType = 'aluno', baseBundle = null } = {}) {
  if (!file) {
    return {
      ok: false,
      errors: [
        buildImportIssue({
          row: null,
          field: 'file',
          code: 'missing_file',
          message: 'Selecione uma planilha para iniciar o dry-run.',
          suggestion: 'Use um arquivo .xlsx com o template oficial.',
        }),
      ],
      warnings: [],
      summary: null,
      draftBundle: null,
      canvasSnapshot: null,
      normalizedRows: [],
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  const worksheet = workbook.worksheets[0]
  const rawRows = []

  if (worksheet) {
    const headers = worksheet
      .getRow(1)
      .values.slice(1)
      .map((value) => String(normalizeExcelCellValue(value) || '').trim())

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const record = Object.fromEntries(
        headers
          .map((header, index) => [header, normalizeExcelCellValue(row.getCell(index + 1).value)])
          .filter(([header]) => header),
      )
      if (Object.values(record).some((value) => String(value ?? '').trim())) rawRows.push(record)
    })
  }

  return dryRunFaqBuilderImport(rawRows, { faqType, baseBundle })
}

export function dryRunFaqBuilderImport(rawRows = [], { faqType = 'aluno', baseBundle = null } = {}) {
  const errors = []
  const warnings = []
  const normalizedRows = rawRows.map((row) => normalizeImportRow(row))
  const ownershipReferenceCatalog = buildFaqBuilderOwnershipReferenceCatalog(baseBundle || {}, {
    faqType,
  })
  const nodeRows = []
  const nodeIds = new Set()
  const bundleOwnerHint = {
    owner_type: '',
    owner_queue: '',
    owner_area: '',
    owner_role: '',
    owner_routing_policy: '',
    owner_fallback_note: '',
  }

  if (!normalizedRows.length) {
    errors.push(
      buildImportIssue({
        row: null,
        field: 'rows',
        code: 'empty_sheet',
        message: 'Planilha sem linhas de dados.',
        suggestion: 'Preencha ao menos um no no template oficial.',
      }),
    )
  }

  normalizedRows.forEach((row, index) => {
    const rowNumber = index + 2
    const nodeId = String(row.node_id || '').trim()
    const shortTitle = String(row.short_title || '').trim()
    const nodeMode = normalizeNodeMode(row.node_type || '')

    if (!nodeId) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'node_id', code: 'missing_node_id', message: 'ID interno obrigatorio.', suggestion: 'Preencha node_id com valor unico.' }))
    }
    if (nodeId && nodeIds.has(nodeId)) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'node_id', code: 'duplicate_node_id', message: `ID duplicado: ${nodeId}.`, suggestion: 'Use IDs diferentes em todas as linhas.' }))
    }
    nodeIds.add(nodeId)

    if (!shortTitle) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'short_title', code: 'missing_short_title', message: 'Titulo curto obrigatorio.', suggestion: 'Preencha short_title.' }))
    }
    if (!nodeMode) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'node_type', code: 'invalid_node_type', message: `Tipo de no invalido: ${row.node_type || 'vazio'}.`, suggestion: "Use 'path' ou 'final'." }))
    }

    const theme = String(row.theme || '').trim()
    const subtheme = String(row.subtheme || '').trim()
    if (!theme || !subtheme) {
      errors.push(buildImportIssue({ row: rowNumber, field: !theme ? 'theme' : 'subtheme', code: 'missing_theme_subtheme', message: 'Tema e subtema sao obrigatorios.', suggestion: 'Preencha theme e subtheme.' }))
    }

    const closingAction = String(row.closing_action || '').trim()
    const effectiveAction = closingAction || (nodeMode === NODE_MODE_MAP.final ? 'mostrar_resposta' : 'ir_para_subniveis')
    if (!hasCatalogValue(ACTION_CATALOG, effectiveAction)) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'closing_action', code: 'invalid_action', message: `Acao invalida: ${effectiveAction || 'vazio'}.`, suggestion: `Use uma acao canonica: ${getCatalogKeys(ACTION_CATALOG).join(', ')}` }))
    }

    const queueDestination = String(row.queue_destination || '').trim() || (faqType === 'op' ? 'op' : 'nao_aplicavel')
    if (!hasCatalogValue(QUEUE_DESTINATION_CATALOG, queueDestination)) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'queue_destination', code: 'invalid_queue_destination', message: `Fila destino invalida: ${queueDestination}.`, suggestion: `Use: ${getCatalogKeys(QUEUE_DESTINATION_CATALOG).join(', ')}` }))
    }

    const criticality = String(row.criticality || '').trim() || 'media'
    if (!hasCatalogValue(CRITICALITY_CATALOG, criticality)) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'criticality', code: 'invalid_criticality', message: `Criticidade invalida: ${criticality}.`, suggestion: `Use: ${getCatalogKeys(CRITICALITY_CATALOG).join(', ')}` }))
    }

    const sla = String(row.sla || '').trim() || '48h'
    if (!hasCatalogValue(SLA_CATALOG, sla)) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'sla', code: 'invalid_sla', message: `SLA invalido: ${sla}.`, suggestion: `Use: ${getCatalogKeys(SLA_CATALOG).join(', ')}` }))
    }

    const ownerInherit = sanitizeOwnershipBoolean(
      row.owner_inherit,
      !String(row.owner_type || row.owner_queue || row.owner_area || row.owner_role || '').trim(),
    )
    const ownerType = normalizeOwnershipType(row.owner_type || '')
    const ownerQueue = String(row.owner_queue || '').trim()
    const ownerArea = String(row.owner_area || '').trim()
    const ownerRole = String(row.owner_role || '').trim()
    const ownerRoutingPolicy = String(row.owner_routing_policy || '').trim()
    const ownerFallbackNote = String(row.owner_fallback_note || '').trim()

    if (!ownerInherit) {
      const overrideOwner = normalizeOperationalOwner(
        {
          owner_type: ownerType,
          owner_queue: ownerQueue,
          owner_area: ownerArea,
          owner_role: ownerRole,
          owner_routing_policy: ownerRoutingPolicy,
          owner_fallback_note: ownerFallbackNote,
        },
        {
          faqType,
          fallbackQueue: resolveDefaultQueueByFaqType(faqType),
        },
      )
      if (!hasOperationalOwnerValue(overrideOwner)) {
        errors.push(
          buildImportIssue({
            row: rowNumber,
            field: 'owner_type',
            code: 'invalid_owner_override',
            message:
              'Override de ownership invalido. Informe fila, area ou role valido, ou marque owner_inherit=sim.',
            suggestion: 'Use owner_queue valido, owner_area preenchida ou owner_role preenchido.',
          }),
        )
      } else {
        const ownerReferenceIssue = resolveOperationalOwnerReferenceIssue(
          overrideOwner,
          ownershipReferenceCatalog,
        )
        if (ownerReferenceIssue) {
          errors.push(
            buildImportIssue({
              row: rowNumber,
              field: ownerReferenceIssue.field,
              code: ownerReferenceIssue.code,
              message: ownerReferenceIssue.message,
              suggestion: 'Corrija a referencia de ownership para fila, area ou role existente.',
            }),
          )
        }
      }
    }

    if (!bundleOwnerHint.owner_type && row.bundle_owner_type) {
      bundleOwnerHint.owner_type = String(row.bundle_owner_type || '').trim()
    }
    if (!bundleOwnerHint.owner_queue && row.bundle_owner_queue) {
      bundleOwnerHint.owner_queue = String(row.bundle_owner_queue || '').trim()
    }
    if (!bundleOwnerHint.owner_area && row.bundle_owner_area) {
      bundleOwnerHint.owner_area = String(row.bundle_owner_area || '').trim()
    }
    if (!bundleOwnerHint.owner_role && row.bundle_owner_role) {
      bundleOwnerHint.owner_role = String(row.bundle_owner_role || '').trim()
    }
    if (!bundleOwnerHint.owner_routing_policy && row.bundle_owner_routing_policy) {
      bundleOwnerHint.owner_routing_policy = String(row.bundle_owner_routing_policy || '').trim()
    }
    if (!bundleOwnerHint.owner_fallback_note && row.bundle_owner_fallback_note) {
      bundleOwnerHint.owner_fallback_note = String(row.bundle_owner_fallback_note || '').trim()
    }

    if (nodeMode === NODE_MODE_MAP.final && !String(row.response_content || '').trim()) {
      errors.push(buildImportIssue({ row: rowNumber, field: 'response_content', code: 'final_without_response', message: 'No final sem conteudo de resposta.', suggestion: 'Preencha response_content.' }))
    }

    nodeRows.push({
      rowNumber,
      nodeId,
      parentId: String(row.parent_id || '').trim(),
      nodeMode,
      shortTitle,
      responseContent: String(row.response_content || '').trim(),
      action: effectiveAction,
      childOrder: Number(row.child_order || 0) || 1,
      theme,
      subtheme,
      status: normalizeWorkflowStatus(row.status || ''),
      internalNote: String(row.internal_note || '').trim(),
      queueDestination,
      criticality,
      sla,
      ownerInherit,
      ownerType,
      ownerQueue,
      ownerArea,
      ownerRole,
      ownerRoutingPolicy,
      ownerFallbackNote,
      slug: String(row.slug || '').trim(),
      tags: String(row.tags || '').split(',').map((item) => item.trim()).filter(Boolean),
    })
  })

  for (const row of nodeRows) {
    if (!row.parentId) {
      continue
    }
    if (!nodeIds.has(row.parentId)) {
      errors.push(buildImportIssue({ row: row.rowNumber, field: 'parent_id', code: 'parent_not_found', message: `Pai inexistente: ${row.parentId}.`, suggestion: 'Use parent_id de uma linha valida ou deixe vazio para raiz.' }))
    }
    if (row.parentId === row.nodeId) {
      errors.push(buildImportIssue({ row: row.rowNumber, field: 'parent_id', code: 'self_reference', message: 'Auto-referencia nao permitida.', suggestion: 'Use outro parent_id.' }))
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
      summary: { totalRows: normalizedRows.length, validRows: Math.max(0, normalizedRows.length - errors.length), totalNodes: 0, totalLinks: 0 },
      draftBundle: null,
      canvasSnapshot: null,
      normalizedRows: nodeRows,
    }
  }

  const template = ensureBundleCollections(cloneJson(baseBundle || cloneFaqBuilderPackage(faqType)))
  const normalizedBundleOwner = normalizeOperationalOwner(
    {
      ...(template.operational_owner || template.metadata?.operational_owner || {}),
      ...bundleOwnerHint,
      owner_type:
        bundleOwnerHint.owner_type ||
        template.operational_owner?.ownerType ||
        template.metadata?.operational_owner?.ownerType ||
        OPERATIONAL_OWNER_TYPE.queue,
      owner_queue:
        bundleOwnerHint.owner_queue ||
        template.operational_owner?.queueKey ||
        resolveDefaultQueueByFaqType(faqType),
    },
    {
      faqType,
      fallbackQueue:
        bundleOwnerHint.owner_queue ||
        template.operational_owner?.queueKey ||
        resolveDefaultQueueByFaqType(faqType),
    },
  )
  const bundleOwnerReferenceIssue = resolveOperationalOwnerReferenceIssue(
    normalizedBundleOwner,
    ownershipReferenceCatalog,
  )
  if (bundleOwnerReferenceIssue) {
    errors.push(
      buildImportIssue({
        row: null,
        field: bundleOwnerReferenceIssue.field,
        code: 'bundle_invalid_owner_reference',
        message: bundleOwnerReferenceIssue.message,
        suggestion: 'Ajuste bundle_owner_* para um destino operacional existente.',
      }),
    )
  }
  template.operational_owner = {
    ownerType: normalizedBundleOwner.ownerType,
    queueKey: normalizedBundleOwner.queueKey,
    queueLabel: normalizedBundleOwner.queueLabel,
    areaLabel: normalizedBundleOwner.areaLabel,
    roleKey: normalizedBundleOwner.roleKey,
    ownerKey: normalizedBundleOwner.ownerKey,
    routingPolicy: normalizedBundleOwner.routingPolicy,
    fallbackNote: normalizedBundleOwner.fallbackNote,
  }
  template.metadata = template.metadata || {}
  template.metadata.operational_owner = cloneJson(template.operational_owner)
  const nodes = nodeRows.map((row) => {
    const nodeKind = normalizeNodeKindByMode(row.nodeMode, Boolean(row.parentId))
    const ownership = {
      inherit: row.ownerInherit,
      ownerType: row.ownerType || OPERATIONAL_OWNER_TYPE.queue,
      queueKey: row.ownerQueue || '',
      areaLabel: row.ownerArea || '',
      roleKey: row.ownerRole || '',
      routingPolicy: row.ownerRoutingPolicy || '',
      fallbackNote: row.ownerFallbackNote || '',
      ownerKey: '',
    }
    ownership.ownerKey = resolveOwnerKey(ownership)
    const node = {
      id: row.nodeId,
      tipo_faq: faqType,
      perfil: faqType === 'op' ? 'op' : 'aluno',
      node_kind: nodeKind,
      tema: row.theme,
      subtema: row.subtheme,
      titulo_exibido: row.shortTitle,
      pergunta_exibida: row.shortTitle,
      descricao_interna: row.internalNote,
      resposta: row.responseContent,
      acao: row.action,
      abre_atendimento: row.action.includes('abrir') || row.action.includes('encaminhar'),
      fila_destino: row.queueDestination,
      criticidade_padrao: row.criticality,
      sla_padrao: row.sla,
      ativo: row.status !== 'archived',
      ordem: row.childOrder,
      permite_anexo: row.action === 'abrir_atendimento_com_anexo',
      campos_exigidos: [],
      palavras_chave: [],
      tags: row.tags,
      publication_status: row.status,
      node_version: template.versioning?.draft_version || '',
      destaque_home: false,
      prioridade_dinamica: 50,
      builder_editable: true,
      spreadsheet_editable: true,
      slug: row.slug,
      ownership,
      owner_inherit: ownership.inherit,
      owner_type: ownership.ownerType,
      owner_queue: ownership.queueKey,
      owner_area: ownership.areaLabel,
      owner_role: ownership.roleKey,
      owner_routing_policy: ownership.routingPolicy,
      owner_fallback_note: ownership.fallbackNote,
      owner_key: ownership.ownerKey,
    }
    if (faqType === 'op') {
      node.checklist_op = []
      node.sistemas_a_consultar = []
      node.documentos_a_solicitar = []
      node.resposta_padrao_sugerida = ''
      node.criterio_de_escalonamento = ''
      node.motivo_escalonamento_sugerido = ''
    }
    return node
  })

  const links = nodeRows
    .filter((row) => row.parentId)
    .sort((left, right) => left.childOrder - right.childOrder)
    .map((row) => ({
      link_id: buildLinkId(row.parentId, row.nodeId),
      faq_id: template.faq_id,
      parent_node_id: row.parentId,
      child_node_id: row.nodeId,
      ordem: row.childOrder,
      ativo: true,
    }))

  template.nodes = nodes
  template.links = links
  template.versioning = template.versioning || {}
  template.versioning.import_source = 'spreadsheet'
  template.versioning.publication_status = 'draft'
  template.versioning.change_summary = 'Importacao em massa por planilha com dry-run validado.'

  const validation = validateFaqBuilderBundle(template, { mode: 'import' })
  const serverCoverageValidation = validateBundleOwnershipCoverageForServer(validation)
  if (validation.errors.length) {
    for (const issue of validation.errors) {
      errors.push(buildImportIssue({ row: null, field: issue.code, code: issue.code, message: issue.message, suggestion: 'Corrija a estrutura e rode o dry-run novamente.', severity: issue.severity }))
    }
  }
  for (const warning of validation.warnings) {
    warnings.push(buildImportIssue({ row: null, field: warning.code, code: warning.code, message: warning.message, suggestion: 'Revise antes de publicar.', severity: 'warning' }))
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      summary: { totalRows: normalizedRows.length, validRows: Math.max(0, normalizedRows.length - errors.length), totalNodes: template.nodes.length, totalLinks: template.links.length },
      draftBundle: null,
      canvasSnapshot: null,
      normalizedRows: nodeRows,
      backendValidation: serverCoverageValidation,
    }
  }

  const canvasSnapshot = buildAutoLayoutSnapshot(template)

  return {
    ok: true,
    errors,
    warnings,
    summary: {
      totalRows: normalizedRows.length,
      validRows: normalizedRows.length,
      totalNodes: template.nodes.length,
      totalLinks: template.links.length,
      roots: inferRootIds(template.nodes, buildIncomingMap(template.links)).length,
      finalNodes: template.nodes.filter((node) => inferNodeMode(node) === NODE_MODE_MAP.final).length,
    },
    draftBundle: template,
    canvasSnapshot,
    normalizedRows: nodeRows,
    backendValidation: serverCoverageValidation,
  }
}

export async function downloadFaqBuilderTemplateXlsx({ faqType = 'aluno' } = {}) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  const templateRows = buildImportTemplateRows(faqType)
  const instructionRows = buildImportInstructionsRows()
  const templateColumns = FAQ_BUILDER_SPREADSHEET_COLUMNS.map((column) => column.key)

  const templateSheet = workbook.addWorksheet('faq_builder_template')
  templateSheet.columns = templateColumns.map((key) => ({ header: key, key, width: 28 }))
  templateSheet.addRows(templateRows)

  const instructionSheet = workbook.addWorksheet('instructions')
  instructionSheet.columns = ['column', 'required', 'description'].map((key) => ({
    header: key,
    key,
    width: key === 'description' ? 72 : 24,
  }))
  instructionSheet.addRows(instructionRows)

  const output = await workbook.xlsx.writeBuffer()
  const blob = new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `faq-builder-template-${faqType}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}
