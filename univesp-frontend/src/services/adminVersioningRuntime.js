import {
  KNOWLEDGE_BUNDLE_VERSION_STATUSES,
  KNOWLEDGE_SUGGESTION_STATUSES,
} from '@/services/canonicalFoundationRuntime'

const BUNDLE_LABELS = Object.freeze({
  faq_aluno: 'FAQ do aluno',
  orientacao_operacional: 'Orientacao operacional',
})

function sortVersions(left, right) {
  const priority = {
    [KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED]: 4,
    [KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED]: 3,
    [KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW]: 2,
    [KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT]: 1,
    [KNOWLEDGE_BUNDLE_VERSION_STATUSES.ARCHIVED]: 0,
  }

  const statusDelta = (priority[right.statusCode] || 0) - (priority[left.statusCode] || 0)
  if (statusDelta !== 0) {
    return statusDelta
  }

  return String(right.versionNumber || '').localeCompare(String(left.versionNumber || ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function countPendingSuggestions(suggestions = []) {
  return suggestions.filter((item) => item.statusCode === KNOWLEDGE_SUGGESTION_STATUSES.PENDING_REVIEW).length
}

export function buildAdminVersioningRuntime({ knowledgeFoundation = {} } = {}) {
  const bundleVersions = [...(knowledgeFoundation.bundleVersions || [])]
  const publications = [...(knowledgeFoundation.publications || [])]
  const nodes = [...(knowledgeFoundation.nodes || [])]
  const links = [...(knowledgeFoundation.nodeLinks || [])]
  const suggestions = [...(knowledgeFoundation.suggestions || [])]

  const bundleTypes = [...new Set(bundleVersions.map((item) => item.bundleType))]
  const bundles = bundleTypes.map((bundleType) => {
    const versions = bundleVersions.filter((item) => item.bundleType === bundleType).sort(sortVersions)
    const publishedVersion = versions.find((item) => item.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED) || null
    const publicationHistory = publications
      .filter((item) => item.bundleType === bundleType)
      .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())

    const versionRows = versions.map((version) => ({
      ...version,
      nodeCount: nodes.filter((item) => item.bundleVersionId === version.id).length,
      linkCount: links.filter((item) => item.bundleVersionId === version.id).length,
      isPublished: version.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
      canApprove: [KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT, KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW].includes(
        version.statusCode,
      ),
      canPublish: [
        KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED,
        KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW,
        KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT,
      ].includes(version.statusCode),
    }))

    return {
      bundleType,
      bundleLabel: BUNDLE_LABELS[bundleType] || bundleType,
      versions: versionRows,
      publishedVersion,
      publicationHistory,
    }
  })

  const metrics = [
    {
      label: 'Bundles canônicos',
      value: bundles.length,
      hint: 'Bases publicadas ou em edicao controlada pelo workflow canonico.',
    },
    {
      label: 'Versoes publicadas',
      value: bundleVersions.filter((item) => item.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED).length,
      hint: 'Versoes ativas que podem ser usadas pelos protocolos.',
    },
    {
      label: 'Versoes em edicao',
      value: bundleVersions.filter((item) =>
        [
          KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT,
          KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW,
          KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED,
        ].includes(item.statusCode),
      ).length,
      hint: 'Rascunhos, revisoes e versoes aprovadas aguardando publicacao.',
    },
    {
      label: 'Sugestoes pendentes',
      value: countPendingSuggestions(suggestions),
      hint: 'Sugestoes da operacao aguardando revisao ou decisao gerencial.',
    },
  ]

  return {
    bundles,
    metrics,
  }
}

export function findKnowledgeBundleRuntime(bundles = [], bundleType = '') {
  return bundles.find((bundle) => bundle.bundleType === bundleType) || null
}
