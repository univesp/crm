import { reactive } from 'vue'

import faqAluno from '../../mocks/faq-aluno.json'
import faqOp from '../../mocks/faq-op.json'
import faqPublico from '../../mocks/faq-publico.json'
import {
  ACTION_CATALOG,
  CRITICALITY_CATALOG,
  FAQ_TYPE_CATALOG,
  NODE_TYPE_CATALOG,
  QUEUE_DESTINATION_CATALOG,
  SLA_CATALOG,
  getCatalogEntry,
  getCatalogKeys,
  hasCatalogValue,
} from './faqCatalogs'

const publishedFaqState = reactive({
  enabled: false,
  aluno: null,
  op: null,
  publico: null,
})

function emptyFaqPackage(faqType) {
  return {
    schema_version: '2.0.0',
    faq_id: `faq-${faqType}-published`,
    tipo_faq: faqType,
    metadata: { title: `FAQ ${faqType}`, source_mode: 'institutional_published' },
    versioning: { publication_status: 'published' },
    publication: {},
    nodes: [],
    links: [],
  }
}

function mergePublishedPackages(faqType, entries = []) {
  const packages = (entries || [])
    .map((entry) => entry?.package || entry)
    .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.nodes))
  if (!packages.length) return emptyFaqPackage(faqType)

  const base = JSON.parse(JSON.stringify(packages[0]))
  const nodes = []
  const links = []
  const nodeIds = new Set()
  const linkIds = new Set()
  packages.forEach((pkg) => {
    ;(pkg.nodes || []).forEach((node) => {
      const id = String(node?.id || '').trim()
      if (!id || nodeIds.has(id)) return
      nodeIds.add(id)
      nodes.push(JSON.parse(JSON.stringify(node)))
    })
    ;(pkg.links || []).forEach((link, index) => {
      const source = String(link?.source || link?.source_id || link?.parent_node_id || '').trim()
      const target = String(link?.target || link?.target_id || link?.child_node_id || '').trim()
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return
      const id = String(link?.id || `${source}:${target}:${index}`).trim()
      if (linkIds.has(id)) return
      linkIds.add(id)
      links.push(JSON.parse(JSON.stringify({ ...link, id })))
    })
  })
  return {
    ...base,
    faq_id: `faq-${faqType}-published`,
    tipo_faq: faqType,
    nodes,
    links,
  }
}

export function enablePublishedFaqRuntime() {
  publishedFaqState.enabled = true
  publishedFaqState.aluno = emptyFaqPackage('aluno')
  publishedFaqState.op = emptyFaqPackage('op')
  publishedFaqState.publico = emptyFaqPackage('publico')
}

export function setPublishedFaqBundles(faqType = 'aluno', entries = []) {
  const normalized = String(faqType || 'aluno').trim().toLowerCase()
  if (!['aluno', 'op', 'publico'].includes(normalized)) return
  publishedFaqState[normalized] = mergePublishedPackages(normalized, entries)
}

function faqPackageFor(faqType, mockPackage) {
  return publishedFaqState.enabled
    ? publishedFaqState[faqType] || emptyFaqPackage(faqType)
    : mockPackage
}

const TARGET_TYPES = new Set(['node', 'tema', 'tag'])
const ACTIVE_PUBLICATION_STATUSES = new Set(['draft', 'review', 'published'])

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  const stringValue = String(value).trim()
  const match = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (match) {
    const [, year, month, day] = match.map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }

  const parsed = new Date(stringValue)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  )
}

function toDateKey(value) {
  const date = normalizeDate(value)

  if (!date) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

function isDateWithinWindow(currentDate, startDate, endDate) {
  const currentKey = toDateKey(currentDate)
  const startKey = toDateKey(startDate)
  const endKey = toDateKey(endDate)

  if (!currentKey) {
    return false
  }

  if (startKey && currentKey < startKey) {
    return false
  }

  if (endKey && currentKey > endKey) {
    return false
  }

  return true
}

function isActiveNode(node, publicationStatus) {
  if (!node || node.ativo === false) {
    return false
  }

  if (!publicationStatus) {
    return true
  }

  return node.publication_status === publicationStatus
}

function matchesProfile(node, profile) {
  if (!profile) {
    return true
  }

  const nodeProfile = node.perfil || node.profile || 'all'

  if (Array.isArray(nodeProfile)) {
    return nodeProfile.includes(profile) || nodeProfile.includes('all')
  }

  return nodeProfile === profile || nodeProfile === 'all'
}

function resolveNodeType(node) {
  return node.node_kind || node.node_type || 'leaf'
}

function compareByPriority(leftPriority, rightPriority) {
  return rightPriority - leftPriority
}

function compareNodes(left, right) {
  const leftOrder = left.runtime.effectiveOrder
  const rightOrder = right.runtime.effectiveOrder

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  const priorityDelta = compareByPriority(
    left.runtime.effectivePriority,
    right.runtime.effectivePriority,
  )

  if (priorityDelta !== 0) {
    return priorityDelta
  }

  return left.titulo_exibido.localeCompare(right.titulo_exibido, 'pt-BR')
}

function matchesHighlightTarget(node, highlight) {
  if (!TARGET_TYPES.has(highlight.target_type)) {
    return false
  }

  if (highlight.target_type === 'node') {
    return node.id === highlight.target_id
  }

  if (highlight.target_type === 'tema') {
    return node.tema === highlight.target_id
  }

  return normalizeArray(node.tags).includes(highlight.target_id)
}

function sortHighlights(highlights) {
  return [...highlights].sort((left, right) => {
    if (left.ordem_dinamica !== right.ordem_dinamica) {
      return left.ordem_dinamica - right.ordem_dinamica
    }

    return right.prioridade_dinamica - left.prioridade_dinamica
  })
}

function resolveNodeHighlights(node, highlights) {
  return sortHighlights(highlights.filter((highlight) => matchesHighlightTarget(node, highlight)))
}

function normalizeRuntimeNode(node, highlight, depth, lineage) {
  const criticality = getCatalogEntry(CRITICALITY_CATALOG, node.criticidade_padrao)
  const sla = getCatalogEntry(SLA_CATALOG, node.sla_padrao)
  const action = getCatalogEntry(ACTION_CATALOG, node.acao)
  const queue = getCatalogEntry(QUEUE_DESTINATION_CATALOG, node.fila_destino, null)
  const nodeType = getCatalogEntry(NODE_TYPE_CATALOG, resolveNodeType(node))
  const effectivePriority = highlight?.prioridade_dinamica ?? node.prioridade_dinamica ?? 0
  const effectiveOrder = highlight?.ordem_dinamica ?? node.ordem ?? Number.MAX_SAFE_INTEGER

  return {
    ...node,
    node_type: resolveNodeType(node),
    children: [],
    runtime: {
      depth,
      lineage,
      isHighlighted: Boolean(highlight?.destaque_home),
      highlightLabel: highlight?.badge_label || null,
      highlightRule: highlight?.regra_de_calendario || null,
      effectivePriority,
      effectiveOrder,
      criticalityLabel: criticality?.label || null,
      criticalityRank: criticality?.rank || 0,
      slaLabel: sla?.label || null,
      slaHours: sla?.hours || null,
      actionLabel: action?.label || null,
      queueLabel: queue?.label || null,
      isTerminal: Boolean(nodeType?.terminal),
    },
  }
}

function buildChildrenMap(links) {
  const childrenByParent = new Map()

  for (const link of links) {
    if (!childrenByParent.has(link.parent_node_id)) {
      childrenByParent.set(link.parent_node_id, [])
    }

    childrenByParent.get(link.parent_node_id).push(link)
  }

  for (const [parentId, parentLinks] of childrenByParent.entries()) {
    childrenByParent.set(
      parentId,
      [...parentLinks].sort((left, right) => left.ordem - right.ordem),
    )
  }

  return childrenByParent
}

function detectCycleNodeIds(nodeIds, links) {
  const adjacency = new Map()
  const visitState = new Map()
  const cycleNodeIds = new Set()

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, [])
  }

  for (const link of links) {
    if (adjacency.has(link.parent_node_id)) {
      adjacency.get(link.parent_node_id).push(link.child_node_id)
    }
  }

  function visit(nodeId, ancestry = []) {
    const currentState = visitState.get(nodeId)

    if (currentState === 'visiting') {
      cycleNodeIds.add(nodeId)

      for (const ancestorId of ancestry) {
        cycleNodeIds.add(ancestorId)
      }

      return
    }

    if (currentState === 'done') {
      return
    }

    visitState.set(nodeId, 'visiting')

    for (const childId of adjacency.get(nodeId) || []) {
      visit(childId, [...ancestry, nodeId])
    }

    visitState.set(nodeId, 'done')
  }

  for (const nodeId of nodeIds) {
    visit(nodeId)
  }

  return [...cycleNodeIds]
}

function createTreeNode({
  node,
  nodeMap,
  childrenByParent,
  highlights,
  depth,
  lineage,
}) {
  const currentLineage = [...lineage, node.id]
  const nodeHighlights = resolveNodeHighlights(node, highlights)
  const runtimeNode = normalizeRuntimeNode(node, nodeHighlights[0] || null, depth, currentLineage)
  const childLinks = childrenByParent.get(node.id) || []

  runtimeNode.children = childLinks
    .map((link) => nodeMap.get(link.child_node_id))
    .filter(Boolean)
    .filter((child) => !currentLineage.includes(child.id))
    .map((child) =>
      createTreeNode({
        node: child,
        nodeMap,
        childrenByParent,
        highlights,
        depth: depth + 1,
        lineage: currentLineage,
      }),
    )
    .sort(compareNodes)

  runtimeNode.runtime.childCount = runtimeNode.children.length

  return runtimeNode
}

export function validateFaqPayload(faqPackage) {
  const errors = []
  const warnings = []
  const nodes = normalizeArray(faqPackage?.nodes)
  const links = normalizeArray(faqPackage?.links)
  const highlights = normalizeArray(faqPackage?.calendar_highlights)
  const nodeIds = new Set()
  const linkIds = new Set()
  const parentCount = new Map()

  if (!hasCatalogValue(FAQ_TYPE_CATALOG, faqPackage?.tipo_faq)) {
    errors.push(
      `tipo_faq invalido: ${String(faqPackage?.tipo_faq || 'vazio')}. Permitidos: ${getCatalogKeys(FAQ_TYPE_CATALOG).join(', ')}.`,
    )
  }

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`node duplicado: ${node.id}.`)
    }

    nodeIds.add(node.id)

    if (!hasCatalogValue(NODE_TYPE_CATALOG, resolveNodeType(node))) {
      errors.push(`node_kind invalido no no ${node.id}.`)
    }

    if (!hasCatalogValue(ACTION_CATALOG, node.acao)) {
      errors.push(`acao invalida no no ${node.id}.`)
    }

    if (!hasCatalogValue(CRITICALITY_CATALOG, node.criticidade_padrao)) {
      errors.push(`criticidade_padrao invalida no no ${node.id}.`)
    }

    if (!hasCatalogValue(SLA_CATALOG, node.sla_padrao)) {
      errors.push(`sla_padrao invalido no no ${node.id}.`)
    }

    if (!hasCatalogValue(QUEUE_DESTINATION_CATALOG, node.fila_destino)) {
      errors.push(`fila_destino invalida no no ${node.id}.`)
    }

    if (
      resolveNodeType(node) === 'leaf' &&
      !node.resposta &&
      !getCatalogEntry(ACTION_CATALOG, node.acao)?.terminal
    ) {
      errors.push(`no folha sem resposta util ou acao terminal: ${node.id}.`)
    }

    if (
      node.publication_status &&
      !ACTIVE_PUBLICATION_STATUSES.has(node.publication_status) &&
      node.publication_status !== 'archived'
    ) {
      warnings.push(`publication_status incomum no no ${node.id}: ${node.publication_status}.`)
    }
  }

  for (const link of links) {
    if (linkIds.has(link.link_id)) {
      errors.push(`link duplicado: ${link.link_id}.`)
    }

    linkIds.add(link.link_id)

    if (link.faq_id && faqPackage?.faq_id && link.faq_id !== faqPackage.faq_id) {
      errors.push(`faq_id inconsistente no link ${link.link_id}.`)
    }

    if (!nodeIds.has(link.parent_node_id)) {
      errors.push(`link com parent_node_id inexistente: ${link.parent_node_id}.`)
    }

    if (!nodeIds.has(link.child_node_id)) {
      errors.push(`link com child_node_id inexistente: ${link.child_node_id}.`)
    }

    if (link.ativo !== false) {
      parentCount.set(link.child_node_id, (parentCount.get(link.child_node_id) || 0) + 1)
    }
  }

  const cycleNodeIds = detectCycleNodeIds([...nodeIds], links.filter((link) => link.ativo !== false))

  if (cycleNodeIds.length > 0) {
    errors.push(`ciclo detectado na arvore: ${cycleNodeIds.join(', ')}.`)
  }

  for (const [childId, totalParents] of parentCount.entries()) {
    if (totalParents > 1) {
      errors.push(`no com mais de um pai ativo: ${childId}.`)
    }
  }

  for (const highlight of highlights) {
    if (!TARGET_TYPES.has(highlight.target_type)) {
      errors.push(`target_type invalido no highlight ${highlight.highlight_id}.`)
    }

    if (highlight.faq_id && faqPackage?.faq_id && highlight.faq_id !== faqPackage.faq_id) {
      errors.push(`faq_id inconsistente no highlight ${highlight.highlight_id}.`)
    }

    const startDate = normalizeDate(highlight.janela_inicio)
    const endDate = normalizeDate(highlight.janela_fim)

    if (!startDate || !endDate) {
      errors.push(`janela invalida no highlight ${highlight.highlight_id}.`)
      continue
    }

    if (startDate > endDate) {
      errors.push(`janela invertida no highlight ${highlight.highlight_id}.`)
    }

    if (highlight.target_type === 'node' && !nodeIds.has(highlight.target_id)) {
      errors.push(`highlight aponta para node inexistente: ${highlight.target_id}.`)
    }

    if (
      highlight.target_type === 'tema' &&
      !nodes.some((node) => node.tema === highlight.target_id)
    ) {
      errors.push(`highlight aponta para tema inexistente: ${highlight.target_id}.`)
    }

    if (
      highlight.target_type === 'tag' &&
      !nodes.some((node) => normalizeArray(node.tags).includes(highlight.target_id))
    ) {
      errors.push(`highlight aponta para tag inexistente: ${highlight.target_id}.`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      nodes: nodes.length,
      links: links.length,
      calendarHighlights: highlights.length,
    },
  }
}

export function getActiveCalendarHighlights(faqPackage, currentDate = new Date()) {
  return normalizeArray(faqPackage?.calendar_highlights)
    .filter((highlight) => !faqPackage?.faq_id || highlight.faq_id === faqPackage.faq_id)
    .filter((highlight) => highlight.ativo !== false)
    .filter((highlight) =>
      isDateWithinWindow(currentDate, highlight.janela_inicio, highlight.janela_fim),
    )
    .filter((highlight) => TARGET_TYPES.has(highlight.target_type))
}

export function buildFaqRuntimeTree(faqPackage, options = {}) {
  const {
    profile = null,
    currentDate = new Date(),
    publicationStatus = null,
  } = options
  const validation = validateFaqPayload(faqPackage)
  const nodes = normalizeArray(faqPackage?.nodes)
    .filter((node) => isActiveNode(node, publicationStatus))
    .filter((node) => matchesProfile(node, profile))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const links = normalizeArray(faqPackage?.links)
    .filter((link) => link.ativo !== false)
    .filter((link) => nodeMap.has(link.parent_node_id) && nodeMap.has(link.child_node_id))
  const childrenByParent = buildChildrenMap(links)
  const childIds = new Set(links.map((link) => link.child_node_id))
  const activeHighlights = getActiveCalendarHighlights(faqPackage, currentDate)
  const roots = nodes.filter((node) => !childIds.has(node.id))

  const tree = roots
    .map((node) =>
      createTreeNode({
        node,
        nodeMap,
        childrenByParent,
        highlights: activeHighlights,
        depth: 0,
        lineage: [],
      }),
    )
    .sort(compareNodes)

  const rootThemes = tree.filter((node) => node.node_type === 'theme')
  const orderedRootThemes = [...rootThemes].sort(compareNodes)

  return {
    faqId: faqPackage?.faq_id || null,
    faqType: faqPackage?.tipo_faq || null,
    profile,
    currentDate: toDateKey(currentDate),
    validation,
    highlights: activeHighlights,
    rootThemes: orderedRootThemes,
    tree,
  }
}

export function buildFaqHomeEntries(faqPackage, options = {}) {
  const runtime = buildFaqRuntimeTree(faqPackage, options)

  return runtime.rootThemes.map((theme) => ({
    id: theme.id,
    title: theme.titulo_exibido,
    description: theme.pergunta_exibida || theme.descricao_interna || theme.resposta || '',
    topics: theme.children.map((child) => child.titulo_exibido),
    badgeLabel: theme.runtime.highlightLabel,
    highlighted: theme.runtime.isHighlighted,
    priority: theme.runtime.effectivePriority,
    queueDestination: theme.fila_destino,
  }))
}

export function buildStudentFaqRuntime(options = {}) {
  return buildFaqRuntimeTree(faqPackageFor('aluno', faqAluno), {
    profile: 'aluno',
    ...options,
  })
}

export function buildOperatorFaqRuntime(options = {}) {
  return buildFaqRuntimeTree(faqPackageFor('op', faqOp), {
    profile: 'op',
    ...options,
  })
}

export function buildStudentFaqHomeEntries(options = {}) {
  return buildFaqHomeEntries(faqPackageFor('aluno', faqAluno), {
    profile: 'aluno',
    ...options,
  })
}

export function buildOperatorFaqHomeEntries(options = {}) {
  return buildFaqHomeEntries(faqPackageFor('op', faqOp), {
    profile: 'op',
    ...options,
  })
}

export function buildPublicFaqRuntime(options = {}) {
  return buildFaqRuntimeTree(faqPackageFor('publico', faqPublico), {
    profile: 'publico',
    ...options,
  })
}

export function buildPublicFaqHomeEntries(options = {}) {
  return buildFaqHomeEntries(faqPackageFor('publico', faqPublico), {
    profile: 'publico',
    ...options,
  })
}
