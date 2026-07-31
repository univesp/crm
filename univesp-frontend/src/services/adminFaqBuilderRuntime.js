import faqAluno from '../../mocks/faq-aluno.json'
import faqOp from '../../mocks/faq-op.json'
import { buildFaqRuntimeTree } from '@/services/faqRuntime'
import {
  ACTION_CATALOG,
  CRITICALITY_CATALOG,
  FAQ_TYPE_CATALOG,
  NODE_TYPE_CATALOG,
  QUEUE_DESTINATION_CATALOG,
  SLA_CATALOG,
  getCatalogKeys,
} from '@/services/faqCatalogs'

const FAQ_PACKAGE_MAP = {
  aluno: faqAluno,
  op: faqOp,
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function titleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildCatalogOptions(catalog) {
  return getCatalogKeys(catalog).map((value) => ({
    value,
    label: catalog[value].label,
  }))
}

function flattenRuntimeTree(nodes = [], collection = []) {
  for (const node of nodes) {
    collection.push({
      id: node.id,
      title: node.titulo_exibido,
      question: node.pergunta_exibida,
      theme: titleCase(node.tema),
      subtheme: titleCase(node.subtema),
      nodeKind: node.node_kind || node.node_type,
      depth: node.runtime?.depth || 0,
      childCount: node.children?.length || 0,
      highlighted: Boolean(node.runtime?.isHighlighted),
      highlightLabel: node.runtime?.highlightLabel || null,
      active: node.ativo !== false,
      actionLabel: node.runtime?.actionLabel || null,
      queueLabel: node.runtime?.queueLabel || null,
      criticalityLabel: node.runtime?.criticalityLabel || null,
      slaLabel: node.runtime?.slaLabel || null,
      lineage: node.runtime?.lineage || [],
    })

    flattenRuntimeTree(node.children || [], collection)
  }

  return collection
}

function buildLinkRows(faqPackage) {
  const nodeById = Object.fromEntries((faqPackage.nodes || []).map((node) => [node.id, node]))

  return (faqPackage.links || [])
    .map((link) => {
      const parentNode = nodeById[link.parent_node_id]
      const childNode = nodeById[link.child_node_id]

      return {
        ...link,
        parentTitle: parentNode?.titulo_exibido || link.parent_node_id,
        childTitle: childNode?.titulo_exibido || link.child_node_id,
        parentTheme: titleCase(parentNode?.tema),
        childKind: titleCase(childNode?.node_kind || childNode?.node_type),
      }
    })
    .sort((left, right) => left.ordem - right.ordem)
}

function buildHighlightRows(faqPackage, runtimeHighlights = []) {
  const activeHighlightIds = new Set(runtimeHighlights.map((highlight) => highlight.highlight_id))
  const nodeById = Object.fromEntries((faqPackage.nodes || []).map((node) => [node.id, node]))

  return (faqPackage.calendar_highlights || [])
    .map((highlight) => {
      const targetNode = nodeById[highlight.target_id]

      return {
        ...highlight,
        activeNow: activeHighlightIds.has(highlight.highlight_id),
        targetLabel:
          highlight.target_type === 'node'
            ? targetNode?.titulo_exibido || highlight.target_id
            : titleCase(highlight.target_id),
      }
    })
    .sort((left, right) => {
      if (left.ordem_dinamica !== right.ordem_dinamica) {
        return left.ordem_dinamica - right.ordem_dinamica
      }

      return right.prioridade_dinamica - left.prioridade_dinamica
    })
}

function buildSummary(faqPackage, runtime, flatNodes, highlights) {
  const leafCount = flatNodes.filter((node) => node.nodeKind === 'leaf').length
  const branchCount = flatNodes.filter((node) => node.nodeKind === 'branch').length
  const highlightedRoots = flatNodes.filter((node) => node.depth === 0 && node.highlighted).length

  return {
    nodes: faqPackage.nodes?.length || 0,
    links: faqPackage.links?.length || 0,
    leafs: leafCount,
    branches: branchCount,
    highlights: faqPackage.calendar_highlights?.length || 0,
    activeHighlights: highlights.filter((highlight) => highlight.activeNow).length,
    highlightedRoots,
    validationErrors: runtime.validation.errors.length,
    validationWarnings: runtime.validation.warnings.length,
  }
}

export function cloneFaqManagementPackage(faqType) {
  return cloneJson(FAQ_PACKAGE_MAP[faqType] || FAQ_PACKAGE_MAP.aluno)
}

export function getFaqManagementCatalogOptions() {
  return {
    faqTypes: buildCatalogOptions(FAQ_TYPE_CATALOG),
    actions: buildCatalogOptions(ACTION_CATALOG),
    criticalities: buildCatalogOptions(CRITICALITY_CATALOG),
    slas: buildCatalogOptions(SLA_CATALOG),
    queues: buildCatalogOptions(QUEUE_DESTINATION_CATALOG),
    nodeKinds: buildCatalogOptions(NODE_TYPE_CATALOG),
  }
}

export function buildFaqManagementRuntime(faqPackage, options = {}) {
  const runtime = buildFaqRuntimeTree(faqPackage, options)
  const flatNodes = flattenRuntimeTree(runtime.tree)
  const links = buildLinkRows(faqPackage)
  const highlights = buildHighlightRows(faqPackage, runtime.highlights)

  return {
    ...runtime,
    flatNodes,
    links,
    highlights,
    summary: buildSummary(faqPackage, runtime, flatNodes, highlights),
  }
}

export function findFaqNodeById(faqPackage, nodeId) {
  return (faqPackage.nodes || []).find((node) => node.id === nodeId) || null
}

export function findFaqHighlightById(faqPackage, highlightId) {
  return (
    (faqPackage.calendar_highlights || []).find(
      (highlight) => highlight.highlight_id === highlightId,
    ) || null
  )
}

export function updateFaqNodeField(faqPackage, nodeId, field, value) {
  const node = findFaqNodeById(faqPackage, nodeId)

  if (!node) {
    return null
  }

  node[field] = value
  return node
}

export function updateFaqNodeListField(faqPackage, nodeId, field, rawValue) {
  const node = findFaqNodeById(faqPackage, nodeId)

  if (!node) {
    return null
  }

  node[field] = String(rawValue)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return node
}

export function updateFaqHighlightField(faqPackage, highlightId, field, value) {
  const highlight = findFaqHighlightById(faqPackage, highlightId)

  if (!highlight) {
    return null
  }

  highlight[field] = value
  return highlight
}

export function formatArrayField(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}
