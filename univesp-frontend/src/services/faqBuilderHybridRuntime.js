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

const DEFAULT_NODE_WIDTH = 250
const DEFAULT_NODE_HEIGHT = 126
const FAQ_BUILDER_LOCAL_STORAGE_PREFIX = 'univesp:faq-builder:workspace'
const FAQ_BUILDER_LIBRARY_STORAGE_KEY = 'univesp:faq-builder:library:v1'
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
})

let xlsxModulePromise = null

async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx')
  }

  const module = await xlsxModulePromise
  return module.default || module
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
  { key: 'slug', label: 'slug', required: false, description: 'Chave opcional para busca e referencia.' },
  { key: 'tags', label: 'tags', required: false, description: 'Tags separadas por virgula.' },
])

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
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

function ensureBundleCollections(bundle = {}) {
  bundle.nodes = Array.isArray(bundle.nodes) ? bundle.nodes : []
  bundle.links = Array.isArray(bundle.links) ? bundle.links : []
  bundle.calendar_highlights = Array.isArray(bundle.calendar_highlights) ? bundle.calendar_highlights : []
  bundle.metadata = bundle.metadata || {}
  bundle.versioning = bundle.versioning || {}
  bundle.publication = bundle.publication || {}
  return bundle
}

function buildIncomingMap(links = []) {
  const map = new Map()
  for (const link of links) {
    if (link.ativo === false) {
      continue
    }
    const current = map.get(link.child_node_id) || []
    map.set(link.child_node_id, [...current, link])
  }
  return map
}

function buildOutgoingMap(links = []) {
  const map = new Map()
  for (const link of links) {
    if (link.ativo === false) {
      continue
    }
    const current = map.get(link.parent_node_id) || []
    map.set(link.parent_node_id, [...current, link])
  }
  return map
}

function buildAdjacency(nodes = [], links = []) {
  const adjacency = new Map()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const link of links) {
    if (link.ativo === false || !adjacency.has(link.parent_node_id) || !adjacency.has(link.child_node_id)) {
      continue
    }
    adjacency.get(link.parent_node_id).push(link.child_node_id)
  }
  return adjacency
}

function detectCycles(nodes = [], links = []) {
  const adjacency = buildAdjacency(nodes, links)
  const visitState = new Map()
  const cycleNodeIds = new Set()

  function visit(nodeId, stack = []) {
    const state = visitState.get(nodeId)

    if (state === 'visiting') {
      cycleNodeIds.add(nodeId)
      for (const item of stack) {
        cycleNodeIds.add(item)
      }
      return
    }

    if (state === 'done') {
      return
    }

    visitState.set(nodeId, 'visiting')
    const nextNodes = adjacency.get(nodeId) || []
    for (const childId of nextNodes) {
      visit(childId, [...stack, nodeId])
    }
    visitState.set(nodeId, 'done')
  }

  for (const node of nodes) {
    visit(node.id)
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
  const outgoingLinks = outgoingMap.get(nodeId) || []
  for (const link of outgoingLinks) {
    if (visited.has(link.child_node_id)) {
      continue
    }
    visited.add(link.child_node_id)
    collectDescendants(link.child_node_id, outgoingMap, visited)
  }
  return visited
}

function inferRootIds(nodes = [], incomingMap = new Map()) {
  return nodes.filter((node) => !(incomingMap.get(node.id) || []).length).map((node) => node.id)
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
  const queueDefault = faqType === 'op' ? 'op' : 'nao_aplicavel'

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
  return {
    faqTypes: buildCatalogOptions(FAQ_TYPE_CATALOG),
    actions: buildCatalogOptions(ACTION_CATALOG),
    queues: buildCatalogOptions(QUEUE_DESTINATION_CATALOG),
    criticalities: buildCatalogOptions(CRITICALITY_CATALOG),
    slas: buildCatalogOptions(SLA_CATALOG),
    nodeModes: [
      { value: NODE_MODE_MAP.path, label: 'Caminho / roteamento' },
      { value: NODE_MODE_MAP.final, label: 'Resposta final' },
    ],
    workflowStatuses: FAQ_BUILDER_WORKFLOW_OPTIONS.map((status) => ({
      value: status,
      label: status,
    })),
  }
}

export function cloneFaqBuilderPackage(faqType = 'aluno') {
  return ensureBundleCollections(cloneJson(FAQ_PACKAGE_MAP[faqType] || FAQ_PACKAGE_MAP.aluno))
}

export function validateFaqBuilderBundle(bundle = {}, options = {}) {
  const mode = options.mode || 'edit'
  ensureBundleCollections(bundle)
  const nodes = bundle.nodes || []
  const links = bundle.links || []
  const issues = []
  const seenNodeIds = new Set()
  const seenLinkIds = new Set()
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const incomingMap = buildIncomingMap(links)
  const outgoingMap = buildOutgoingMap(links)

  for (const node of nodes) {
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
  }

  for (const link of links) {
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

  const cycleNodeIds = detectCycles(nodes, links)
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

  if (!nodes.length) {
    issues.push({
      severity: 'error',
      code: 'empty_bundle',
      nodeId: '',
      message: 'Fluxo vazio: nenhum no definido.',
      blocksImport: mode === 'import',
      blocksPublish: true,
    })
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
    hasBlockingImportError,
    hasBlockingPublishError,
  }
}

export function buildAutoLayoutSnapshot(bundle = {}, existingSnapshot = {}, options = {}) {
  ensureBundleCollections(bundle)
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

  for (const node of bundle.nodes) {
    graph.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    })
  }

  for (const link of bundle.links) {
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
  for (const node of bundle.nodes) {
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
    edges: bundle.links
      .filter((link) => link.ativo !== false)
      .map((link) => ({
        id: link.link_id,
        source: link.parent_node_id,
        target: link.child_node_id,
      })),
    updatedAt: nowIso(),
  }
}

export function buildFaqBuilderGraph(bundle = {}, canvasSnapshot = {}, validation = null) {
  ensureBundleCollections(bundle)
  const issueSummary = validation?.nodeIssueSummary || new Map()
  const snapshotPositions = canvasSnapshot?.nodePositions || {}
  const nodes = bundle.nodes.map((node) => {
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
        status: node.publication_status || 'draft',
        issueCount: summary?.count || 0,
        issueSeverity: summary?.hasError ? 'error' : summary?.hasWarning ? 'warning' : 'none',
        issueLabels: summary?.labels || [],
      },
    }
  })

  const edges = bundle.links
    .filter((link) => link.ativo !== false)
    .map((link) => ({
      id: link.link_id,
      source: link.parent_node_id,
      target: link.child_node_id,
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
  }
}

export function createFaqBuilderWorkspaceFromBundle(
  bundle = {},
  editorName = 'Admin local',
  options = {},
) {
  const draftBundle = ensureBundleCollections(cloneJson(bundle || {}))
  const publishedBundle = ensureBundleCollections(cloneJson(options.publishedBundle || bundle || {}))
  const canvasSnapshot = options.canvasSnapshot
    ? cloneJson(options.canvasSnapshot)
    : buildAutoLayoutSnapshot(draftBundle)
  const publishedCanvasSnapshot = options.publishedCanvasSnapshot
    ? cloneJson(options.publishedCanvasSnapshot)
    : buildAutoLayoutSnapshot(publishedBundle)
  const draftStatus =
    WORKFLOW_STATUS_MAP[draftBundle.versioning?.publication_status || 'draft'] || 'Draft'

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
    const roots = (faqPackage.nodes || []).filter(
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

  const rawValue = window.localStorage.getItem(FAQ_BUILDER_LIBRARY_STORAGE_KEY)
  if (!rawValue) {
    const seeded = createFaqBuilderBundleLibrary(editorName)
    saveFaqBuilderBundleLibraryLocal(seeded)
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

export function saveFaqBuilderBundleLibraryLocal(library = {}) {
  if (typeof window === 'undefined') {
    return
  }
  const payload = normalizeLibraryPayload(library, library?.bundles?.[0]?.updatedBy || 'Admin local')
  payload.updatedAt = nowIso()
  window.localStorage.setItem(FAQ_BUILDER_LIBRARY_STORAGE_KEY, JSON.stringify(payload))
}

export function getFaqBuilderBundleById(library = {}, bundleId = '') {
  return (library.bundles || []).find((entry) => entry.bundleId === bundleId) || null
}

export function listFaqBuilderBundles(
  library = {},
  { search = '', status = 'all', faqType = 'all' } = {},
) {
  const query = normalizeText(search)
  const statusQuery = normalizeText(status)
  const faqTypeQuery = normalizeText(faqType)
  return (library.bundles || [])
    .map((entry) => {
      const validation = validateFaqBuilderBundle(entry.workspace?.draftBundle || {})
      const workflowStatus = entry.workspace?.workflowStatus || 'Draft'
      const statusKey = normalizeText(workflowStatus)
      const nodeCount = entry.workspace?.draftBundle?.nodes?.length || 0
      return {
        bundleId: entry.bundleId,
        title: entry.title,
        description: entry.description,
        faqType: entry.faqType,
        subjectKey: entry.subjectKey,
        workflowStatus,
        statusKey,
        nodeCount,
        linkCount: entry.workspace?.draftBundle?.links?.length || 0,
        updatedAt: entry.workspace?.lockContext?.lastTouchedAt || entry.updatedAt,
        updatedBy: entry.workspace?.lockContext?.editorName || entry.updatedBy,
        publishedVersion:
          entry.workspace?.draftBundle?.versioning?.published_version ||
          entry.workspace?.publishedBundle?.versioning?.published_version ||
          '-',
        validationErrors: validation.errors.length,
        validationWarnings: validation.warnings.length,
        hasBlockingError: validation.hasBlockingPublishError,
      }
    })
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
        fila_destino: faqType === 'op' ? 'op' : 'nao_aplicavel',
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
        fila_destino: faqType === 'op' ? 'op' : 'nao_aplicavel',
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
  const rawValue = window.localStorage.getItem(storageKey)
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
  })

  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

export function clearFaqBuilderWorkspaceLocal(faqType = 'aluno') {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(getWorkspaceStorageKey(faqType))
}

export function touchFaqBuilderWorkspace(workspace, actorName = 'Admin local') {
  if (!workspace?.lockContext) {
    return
  }
  workspace.lockContext.editorName = actorName
  workspace.lockContext.lastTouchedAt = nowIso()
}

export function getFaqBuilderNode(bundle = {}, nodeId = '') {
  ensureBundleCollections(bundle)
  return bundle.nodes.find((node) => node.id === nodeId) || null
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
    .filter((link) => link.ativo !== false)
    .map((link) => ({
      id: link.link_id,
      source: link.parent_node_id,
      target: link.child_node_id,
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
  const existingIds = new Set(bundle.nodes.map((node) => node.id))
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
    fila_destino: parentNode.fila_destino || (bundle.tipo_faq === 'op' ? 'op' : 'nao_aplicavel'),
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
  }

  if (bundle.tipo_faq === 'op') {
    newNode.checklist_op = []
    newNode.sistemas_a_consultar = []
    newNode.documentos_a_solicitar = []
    newNode.resposta_padrao_sugerida = ''
    newNode.criterio_de_escalonamento = ''
    newNode.motivo_escalonamento_sugerido = ''
  }

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
  const draftNodesById = new Map(draftBundle.nodes.map((node) => [node.id, node]))
  const publishedNodesById = new Map(publishedBundle.nodes.map((node) => [node.id, node]))
  const createdNodes = []
  const removedNodes = []
  const updatedNodes = []

  for (const draftNode of draftBundle.nodes) {
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

  for (const publishedNode of publishedBundle.nodes) {
    if (!draftNodesById.has(publishedNode.id)) {
      removedNodes.push(publishedNode)
    }
  }

  const draftLinks = new Set(
    draftBundle.links.filter((link) => link.ativo !== false).map((link) => `${link.parent_node_id}->${link.child_node_id}`),
  )
  const publishedLinks = new Set(
    publishedBundle.links.filter((link) => link.ativo !== false).map((link) => `${link.parent_node_id}->${link.child_node_id}`),
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

export function publishFaqBuilderWorkspace(workspace = {}, { actorName = 'Admin local', summary = '' } = {}) {
  const validation = validateFaqBuilderBundle(workspace.draftBundle)
  if (validation.hasBlockingPublishError) {
    return {
      ok: false,
      message: 'Publicacao bloqueada: existem erros estruturais.',
      validation,
    }
  }

  workspace.publishedBundle = cloneJson(workspace.draftBundle)
  workspace.publishedCanvasSnapshot = cloneJson(workspace.canvasSnapshot || {})
  workspace.workflowStatus = 'Published'
  workspace.versionCounter = Number(workspace.versionCounter || 1) + 1
  workspace.draftBundle.versioning = workspace.draftBundle.versioning || {}
  workspace.draftBundle.publication = workspace.draftBundle.publication || {}
  workspace.draftBundle.versioning.publication_status = 'published'
  workspace.draftBundle.versioning.published_version = `v${workspace.versionCounter}.0`
  workspace.draftBundle.versioning.change_summary = summary || workspace.draftBundle.versioning.change_summary || ''
  workspace.draftBundle.publication.last_published_at = nowIso()
  workspace.draftBundle.publication.last_published_by = actorName
  workspace.draftBundle.publication.can_publish = true
  workspace.changeLog = Array.isArray(workspace.changeLog) ? workspace.changeLog : []
  workspace.changeLog.unshift({
    id: `publish-${Date.now()}`,
    actor: actorName,
    action: 'published',
    at: nowIso(),
    details: summary || 'Publicacao manual pelo Builder.',
  })
  touchFaqBuilderWorkspace(workspace, actorName)

  return {
    ok: true,
    validation,
  }
}

export function buildFaqBuilderPreviewJourney(bundle = {}, startNodeId = '') {
  ensureBundleCollections(bundle)
  const nodeById = new Map(bundle.nodes.map((node) => [node.id, node]))
  const outgoingMap = buildOutgoingMap(bundle.links)
  const incomingMap = buildIncomingMap(bundle.links)
  const rootIds = inferRootIds(bundle.nodes, incomingMap)
  const startId = startNodeId && nodeById.has(startNodeId) ? startNodeId : rootIds[0] || ''

  return {
    rootIds,
    startId,
    nodeById,
    outgoingMap,
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
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  return dryRunFaqBuilderImport(rawRows, { faqType, baseBundle })
}

export function dryRunFaqBuilderImport(rawRows = [], { faqType = 'aluno', baseBundle = null } = {}) {
  const errors = []
  const warnings = []
  const normalizedRows = rawRows.map((row) => normalizeImportRow(row))
  const nodeRows = []
  const nodeIds = new Set()

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
  const nodes = nodeRows.map((row) => {
    const nodeKind = normalizeNodeKindByMode(row.nodeMode, Boolean(row.parentId))
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
  }
}

export async function downloadFaqBuilderTemplateXlsx({ faqType = 'aluno' } = {}) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  const templateRows = buildImportTemplateRows(faqType)
  const instructionRows = buildImportInstructionsRows()
  const templateSheet = XLSX.utils.json_to_sheet(templateRows, {
    header: FAQ_BUILDER_SPREADSHEET_COLUMNS.map((column) => column.key),
  })
  const instructionSheet = XLSX.utils.json_to_sheet(instructionRows, {
    header: ['column', 'required', 'description'],
  })

  XLSX.utils.book_append_sheet(workbook, templateSheet, 'faq_builder_template')
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'instructions')
  XLSX.writeFile(workbook, `faq-builder-template-${faqType}.xlsx`)
}
