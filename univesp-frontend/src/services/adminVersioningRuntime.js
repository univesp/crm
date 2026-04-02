import { adminVersioningSeed } from '../../mocks/adminVersioning'
import {
  ACTION_CATALOG,
  CRITICALITY_CATALOG,
  QUEUE_DESTINATION_CATALOG,
  SLA_CATALOG,
} from '@/services/faqCatalogs'
import {
  PERMISSION_ACTION_CATALOG,
  PERMISSION_SCOPE_CATALOG,
} from '@/services/adminPermissionsRuntime'

const DOMAIN_ORDER = ['faq', 'parameters', 'permissions']
const CHANGE_ORDER = {
  changed: 0,
  new: 1,
  removed: 2,
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

function formatTimestamp(currentDate = new Date()) {
  const date = currentDate instanceof Date ? currentDate : new Date(currentDate)
  const pad = (value) => String(value).padStart(2, '0')

  return {
    iso: date.toISOString(),
    compact: String(date.getTime()),
    label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function formatCatalogValue(catalog, value) {
  if (value == null || value === '') {
    return 'Nao informado'
  }

  return catalog?.[value]?.label || titleCase(value)
}

function formatBoolean(value) {
  return value ? 'Sim' : 'Nao'
}

function formatPrimitive(value) {
  if (value == null || value === '') {
    return 'Nao informado'
  }

  return String(value)
}

function formatArrayValue(value = [], formatter = formatPrimitive) {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Nenhum'
  }

  return value.map((item) => formatter(item)).join(', ')
}

function formatPermissionActions(value = {}) {
  const labels = Object.entries(PERMISSION_ACTION_CATALOG)
    .filter(([key]) => Boolean(value?.[key]))
    .map(([, metadata]) => metadata.label)

  return labels.length ? labels.join(', ') : 'Nenhuma'
}

function normalizeComparableValue(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((entry) => normalizeComparableValue(entry)).sort((left, right) =>
        String(left).localeCompare(String(right)),
      ),
    )
  }

  if (value && typeof value === 'object') {
    const normalizedObject = Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, normalizeComparableValue(value[key])]),
    )

    return JSON.stringify(normalizedObject)
  }

  return value == null ? '' : String(value)
}

function buildFieldChange(draftItem, publishedItem, field) {
  const draftValue = draftItem?.[field.key]
  const publishedValue = publishedItem?.[field.key]
  const normalizedDraft = field.normalize
    ? field.normalize(draftValue)
    : normalizeComparableValue(draftValue)
  const normalizedPublished = field.normalize
    ? field.normalize(publishedValue)
    : normalizeComparableValue(publishedValue)

  if (normalizedDraft === normalizedPublished) {
    return null
  }

  const formatter = field.format || formatPrimitive

  return {
    key: field.key,
    label: field.label,
    from: formatter(publishedValue, publishedItem),
    to: formatter(draftValue, draftItem),
  }
}

function buildDiffItem({
  changeType,
  groupLabel,
  itemTypeLabel,
  itemKey,
  title,
  subtitle,
  description,
  fieldChanges = [],
}) {
  const summary =
    changeType === 'changed'
      ? `${fieldChanges.length} campo(s) alterado(s)`
      : changeType === 'new'
        ? 'Item novo no draft'
        : 'Item removido do draft atual'

  return {
    id: `${groupLabel}:${itemKey}`,
    changeType,
    groupLabel,
    itemTypeLabel,
    itemKey,
    title,
    subtitle,
    description,
    summary,
    fieldChanges,
  }
}

function diffCollection({
  draftItems = [],
  publishedItems = [],
  keyField,
  groupLabel,
  itemTypeLabel,
  fieldSpecs = [],
  buildTitle,
  buildSubtitle = () => '',
  buildDescription = () => '',
}) {
  const draftMap = Object.fromEntries(draftItems.map((item) => [item[keyField], item]))
  const publishedMap = Object.fromEntries(publishedItems.map((item) => [item[keyField], item]))
  const keys = [...new Set([...Object.keys(publishedMap), ...Object.keys(draftMap)])]

  return keys
    .map((itemKey) => {
      const draftItem = draftMap[itemKey]
      const publishedItem = publishedMap[itemKey]
      const referenceItem = draftItem || publishedItem

      if (!publishedItem) {
        return buildDiffItem({
          changeType: 'new',
          groupLabel,
          itemTypeLabel,
          itemKey,
          title: buildTitle(referenceItem),
          subtitle: buildSubtitle(referenceItem),
          description: buildDescription(referenceItem),
        })
      }

      if (!draftItem) {
        return buildDiffItem({
          changeType: 'removed',
          groupLabel,
          itemTypeLabel,
          itemKey,
          title: buildTitle(referenceItem),
          subtitle: buildSubtitle(referenceItem),
          description: buildDescription(referenceItem),
        })
      }

      const fieldChanges = fieldSpecs
        .map((field) => buildFieldChange(draftItem, publishedItem, field))
        .filter(Boolean)

      if (!fieldChanges.length) {
        return null
      }

      return buildDiffItem({
        changeType: 'changed',
        groupLabel,
        itemTypeLabel,
        itemKey,
        title: buildTitle(referenceItem),
        subtitle: buildSubtitle(referenceItem),
        description: buildDescription(referenceItem),
        fieldChanges,
      })
    })
    .filter(Boolean)
}

function summarizeDiffMetrics(diffItems = []) {
  const changed = diffItems.filter((item) => item.changeType === 'changed').length
  const added = diffItems.filter((item) => item.changeType === 'new').length
  const removed = diffItems.filter((item) => item.changeType === 'removed').length
  const fieldChanges = diffItems.reduce(
    (total, item) => total + (item.fieldChanges?.length || 0),
    0,
  )

  return {
    changed,
    added,
    removed,
    fieldChanges,
    total: diffItems.length,
  }
}

function buildDiffSummary(metrics) {
  const parts = []

  if (metrics.changed > 0) {
    parts.push(`${metrics.changed} item(ns) alterado(s)`)
  }

  if (metrics.added > 0) {
    parts.push(`${metrics.added} novo(s)`)
  }

  if (metrics.removed > 0) {
    parts.push(`${metrics.removed} removido(s)`)
  }

  if (metrics.fieldChanges > 0) {
    parts.push(`${metrics.fieldChanges} campo(s) em diff`)
  }

  return parts.length ? parts.join(' • ') : 'Sem diferencas entre draft e publicado.'
}

function buildFaqDomainDiff(domain) {
  const fieldSpecs = [
    { key: 'tema', label: 'Tema', format: titleCase },
    { key: 'subtema', label: 'Subtema', format: titleCase },
    { key: 'titulo_exibido', label: 'Titulo' },
    { key: 'pergunta_exibida', label: 'Pergunta' },
    { key: 'resposta', label: 'Resposta' },
    { key: 'acao', label: 'Action', format: (value) => formatCatalogValue(ACTION_CATALOG, value) },
    {
      key: 'fila_destino',
      label: 'Fila destino',
      format: (value) => formatCatalogValue(QUEUE_DESTINATION_CATALOG, value),
    },
    {
      key: 'criticidade_padrao',
      label: 'Criticidade',
      format: (value) => formatCatalogValue(CRITICALITY_CATALOG, value),
    },
    {
      key: 'sla_padrao',
      label: 'SLA',
      format: (value) => formatCatalogValue(SLA_CATALOG, value),
    },
    { key: 'prioridade_dinamica', label: 'Prioridade dinamica' },
    { key: 'ativo', label: 'Ativo', format: formatBoolean },
    { key: 'permite_anexo', label: 'Permite anexo', format: formatBoolean },
    {
      key: 'campos_exigidos',
      label: 'Campos exigidos',
      format: (value) => formatArrayValue(value),
    },
    {
      key: 'checklist_op',
      label: 'Checklist OP',
      format: (value) => formatArrayValue(value),
    },
    {
      key: 'sistemas_a_consultar',
      label: 'Sistemas a consultar',
      format: (value) => formatArrayValue(value),
    },
    {
      key: 'documentos_a_solicitar',
      label: 'Documentos a solicitar',
      format: (value) => formatArrayValue(value),
    },
    { key: 'criterio_de_escalonamento', label: 'Criterio de escalonamento' },
    {
      key: 'motivo_escalonamento_sugerido',
      label: 'Motivo de escalonamento',
    },
  ]
  const linkSpecs = [
    { key: 'parent_node_id', label: 'No pai' },
    { key: 'child_node_id', label: 'No filho' },
    { key: 'ordem', label: 'Ordem' },
    { key: 'ativo', label: 'Ativo', format: formatBoolean },
  ]
  const highlightSpecs = [
    { key: 'target_type', label: 'Tipo de alvo', format: titleCase },
    { key: 'target_id', label: 'Alvo' },
    { key: 'janela_inicio', label: 'Janela inicio' },
    { key: 'janela_fim', label: 'Janela fim' },
    { key: 'prioridade_dinamica', label: 'Prioridade dinamica' },
    { key: 'ordem_dinamica', label: 'Ordem dinamica' },
    { key: 'badge_label', label: 'Badge' },
    { key: 'destaque_home', label: 'Destaque home', format: formatBoolean },
    { key: 'ativo', label: 'Ativo', format: formatBoolean },
  ]

  const packages = [
    {
      label: 'FAQ do aluno',
      draft: domain.draft.payload.aluno,
      published: domain.published.payload.aluno,
    },
    {
      label: 'Playbook do OP',
      draft: domain.draft.payload.op,
      published: domain.published.payload.op,
    },
  ]

  const diffItems = packages.flatMap((entry) => [
    ...diffCollection({
      draftItems: entry.draft.nodes,
      publishedItems: entry.published.nodes,
      keyField: 'id',
      groupLabel: `${entry.label} • Nodes`,
      itemTypeLabel: 'Node',
      fieldSpecs,
      buildTitle: (item) => item.titulo_exibido || item.id,
      buildSubtitle: (item) => `${titleCase(item.tema)} • ${titleCase(item.subtema)}`,
      buildDescription: (item) => item.pergunta_exibida || '',
    }),
    ...diffCollection({
      draftItems: entry.draft.links,
      publishedItems: entry.published.links,
      keyField: 'link_id',
      groupLabel: `${entry.label} • Links`,
      itemTypeLabel: 'Link',
      fieldSpecs: linkSpecs,
      buildTitle: (item) => `${item.parent_node_id} -> ${item.child_node_id}`,
      buildSubtitle: () => entry.label,
    }),
    ...diffCollection({
      draftItems: entry.draft.calendar_highlights,
      publishedItems: entry.published.calendar_highlights,
      keyField: 'highlight_id',
      groupLabel: `${entry.label} • Highlights`,
      itemTypeLabel: 'Highlight',
      fieldSpecs: highlightSpecs,
      buildTitle: (item) => item.badge_label || item.highlight_id,
      buildSubtitle: (item) => `${titleCase(item.target_type)} • ${titleCase(item.target_id)}`,
      buildDescription: (item) => item.regra_de_calendario,
    }),
  ])

  return diffItems
}

function buildParametersDomainDiff(domain) {
  const criticalitySpecs = [
    { key: 'label', label: 'Label' },
    { key: 'badgeLabel', label: 'Badge' },
    { key: 'backgroundColor', label: 'Cor de fundo' },
    { key: 'textColor', label: 'Cor do texto' },
    { key: 'operationalPriority', label: 'Prioridade operacional' },
    { key: 'note', label: 'Nota' },
  ]
  const slaSpecs = [
    { key: 'label', label: 'Label' },
    { key: 'badgeLabel', label: 'Badge' },
    { key: 'backgroundColor', label: 'Cor de fundo' },
    { key: 'textColor', label: 'Cor do texto' },
    { key: 'hours', label: 'Horas' },
    { key: 'operationalPriority', label: 'Prioridade operacional' },
    { key: 'note', label: 'Nota' },
  ]
  const ruleSpecs = [
    { key: 'active', label: 'Ativa', format: formatBoolean },
    { key: 'targetType', label: 'Tipo de alvo', format: titleCase },
    { key: 'targetValue', label: 'Alvo', format: titleCase },
    {
      key: 'criticalityKey',
      label: 'Criticidade aplicada',
      format: (value) => formatCatalogValue(CRITICALITY_CATALOG, value),
    },
    {
      key: 'slaKey',
      label: 'SLA aplicado',
      format: (value) => formatCatalogValue(SLA_CATALOG, value),
    },
    { key: 'note', label: 'Nota' },
  ]

  return [
    ...diffCollection({
      draftItems: domain.draft.payload.criticalityLevels,
      publishedItems: domain.published.payload.criticalityLevels,
      keyField: 'key',
      groupLabel: 'Parametros • Criticidade',
      itemTypeLabel: 'Nivel de criticidade',
      fieldSpecs: criticalitySpecs,
      buildTitle: (item) => item.label,
      buildSubtitle: (item) => item.key,
    }),
    ...diffCollection({
      draftItems: domain.draft.payload.slaLevels,
      publishedItems: domain.published.payload.slaLevels,
      keyField: 'key',
      groupLabel: 'Parametros • SLA',
      itemTypeLabel: 'Nivel de SLA',
      fieldSpecs: slaSpecs,
      buildTitle: (item) => item.label,
      buildSubtitle: (item) => item.key,
    }),
    ...diffCollection({
      draftItems: domain.draft.payload.applicationRules,
      publishedItems: domain.published.payload.applicationRules,
      keyField: 'id',
      groupLabel: 'Parametros • Regras',
      itemTypeLabel: 'Regra',
      fieldSpecs: ruleSpecs,
      buildTitle: (item) => item.id,
      buildSubtitle: (item) => `${titleCase(item.targetType)} • ${titleCase(item.targetValue)}`,
      buildDescription: (item) => item.note,
    }),
  ]
}

function buildPermissionsDomainDiff(domain) {
  const profileSpecs = [
    { key: 'label', label: 'Label' },
    { key: 'description', label: 'Descricao' },
  ]
  const areaSpecs = [
    { key: 'label', label: 'Label' },
    {
      key: 'queues',
      label: 'Filas',
      format: (value) => formatArrayValue(value),
    },
  ]
  const matrixSpecs = [
    { key: 'profileKey', label: 'Perfil', format: titleCase },
    {
      key: 'scopeType',
      label: 'Escopo',
      format: (value) => formatCatalogValue(PERMISSION_SCOPE_CATALOG, value),
    },
    {
      key: 'scopeValues',
      label: 'Fila / area',
      format: (value) => formatArrayValue(value, titleCase),
    },
    {
      key: 'allowedActions',
      label: 'Permissoes',
      format: formatPermissionActions,
    },
    { key: 'note', label: 'Nota' },
  ]

  return [
    ...diffCollection({
      draftItems: domain.draft.payload.profiles,
      publishedItems: domain.published.payload.profiles,
      keyField: 'key',
      groupLabel: 'Permissoes • Perfis',
      itemTypeLabel: 'Perfil',
      fieldSpecs: profileSpecs,
      buildTitle: (item) => item.label,
      buildSubtitle: (item) => item.key,
      buildDescription: (item) => item.description,
    }),
    ...diffCollection({
      draftItems: domain.draft.payload.areas,
      publishedItems: domain.published.payload.areas,
      keyField: 'id',
      groupLabel: 'Permissoes • Areas',
      itemTypeLabel: 'Area',
      fieldSpecs: areaSpecs,
      buildTitle: (item) => item.label,
      buildSubtitle: (item) => item.id,
    }),
    ...diffCollection({
      draftItems: domain.draft.payload.matrix,
      publishedItems: domain.published.payload.matrix,
      keyField: 'id',
      groupLabel: 'Permissoes • Politicas',
      itemTypeLabel: 'Politica',
      fieldSpecs: matrixSpecs,
      buildTitle: (item) => item.id,
      buildSubtitle: (item) => `${titleCase(item.profileKey)} • ${formatCatalogValue(PERMISSION_SCOPE_CATALOG, item.scopeType)}`,
      buildDescription: (item) => item.note,
    }),
  ]
}

function buildDomainDiff(domain) {
  if (domain.key === 'faq') {
    return buildFaqDomainDiff(domain)
  }

  if (domain.key === 'parameters') {
    return buildParametersDomainDiff(domain)
  }

  return buildPermissionsDomainDiff(domain)
}

function buildDomainMetrics(diffItems) {
  const summary = summarizeDiffMetrics(diffItems)

  return [
    {
      label: 'Itens alterados',
      value: summary.changed,
      hint: 'Itens existentes cujo conteudo mudou entre draft e publicado.',
    },
    {
      label: 'Itens novos',
      value: summary.added,
      hint: 'Itens presentes apenas no draft atual.',
    },
    {
      label: 'Itens removidos',
      value: summary.removed,
      hint: 'Itens que existiam no publicado e sairam do draft.',
    },
    {
      label: 'Campos em diff',
      value: summary.fieldChanges,
      hint: 'Soma dos campos alterados no dominio selecionado.',
    },
  ]
}

function buildDomainRuntime(domain) {
  const diffItems = buildDomainDiff(domain).sort((left, right) => {
    if (CHANGE_ORDER[left.changeType] !== CHANGE_ORDER[right.changeType]) {
      return CHANGE_ORDER[left.changeType] - CHANGE_ORDER[right.changeType]
    }

    return left.groupLabel.localeCompare(right.groupLabel)
  })
  const diffSummary = summarizeDiffMetrics(diffItems)

  return {
    ...domain,
    diffItems,
    diffSummary,
    diffHeadline: buildDiffSummary(diffSummary),
    metrics: buildDomainMetrics(diffItems),
  }
}

function buildVersionEvent({
  actionType,
  actor,
  domain,
  previousVersion,
  nextVersion,
  summary,
  currentDate,
}) {
  const timestamp = formatTimestamp(currentDate)

  return {
    id: `version-event-${timestamp.compact}`,
    actionType,
    actorName: actor.name,
    actorRole: actor.role,
    domainKey: domain.key,
    domainLabel: domain.label,
    changedAt: timestamp.iso,
    changedAtLabel: timestamp.label,
    previousVersion,
    nextVersion,
    summary,
  }
}

function findDomain(state, domainKey) {
  return state?.domains?.[domainKey] || null
}

export function cloneAdminVersioningState() {
  return cloneJson(adminVersioningSeed)
}

export function buildAdminVersioningRuntime({ state }) {
  const domains = DOMAIN_ORDER.map((domainKey) => {
    const domain = findDomain(state, domainKey)
    return buildDomainRuntime(domain)
  })
  const publicationEvents = [...(state?.publicationEvents || [])].sort((left, right) =>
    String(right.changedAt).localeCompare(String(left.changedAt)),
  )

  return {
    currentActor: state?.currentActor || null,
    domains,
    publicationEvents,
  }
}

export function findVersioningDomain(domains = [], domainKey) {
  return domains.find((domain) => domain.key === domainKey) || null
}

export function findDiffItem(diffItems = [], diffId) {
  return diffItems.find((item) => item.id === diffId) || null
}

export function applyDomainApproval({
  state,
  domainKey,
  actor,
  currentDate = new Date(),
}) {
  const domain = findDomain(state, domainKey)

  if (!domain) {
    return null
  }

  const runtime = buildDomainRuntime(domain)
  const timestamp = formatTimestamp(currentDate)
  domain.approval.status = 'approved'
  domain.approval.approvedAt = timestamp.label
  domain.approval.approvedBy = actor.name
  domain.approval.approvedRole = actor.role

  const event = buildVersionEvent({
    actionType: 'approve',
    actor,
    domain,
    previousVersion: domain.published.version,
    nextVersion: domain.draft.version,
    summary: `Aprovou ${domain.label}: ${buildDiffSummary(runtime.diffSummary)}`,
    currentDate,
  })

  state.publicationEvents = [event, ...(state.publicationEvents || [])]
  return event
}

export function applyDomainPublication({
  state,
  domainKey,
  actor,
  currentDate = new Date(),
}) {
  const domain = findDomain(state, domainKey)

  if (!domain) {
    return null
  }

  const runtime = buildDomainRuntime(domain)
  const previousVersion = domain.published.version
  const nextVersion = domain.draft.version
  const timestamp = formatTimestamp(currentDate)

  domain.published = cloneJson(domain.draft)
  domain.published.status = 'published'
  domain.published.updatedAt = timestamp.label
  domain.published.updatedBy = actor.name
  domain.published.summary = `Publicado em modo mock a partir do draft ${nextVersion}.`

  domain.approval.status = 'published'
  domain.approval.approvedAt = timestamp.label
  domain.approval.approvedBy = actor.name
  domain.approval.approvedRole = actor.role

  const event = buildVersionEvent({
    actionType: 'publish',
    actor,
    domain,
    previousVersion,
    nextVersion,
    summary: `Publicou ${domain.label}: ${buildDiffSummary(runtime.diffSummary)}`,
    currentDate,
  })

  state.publicationEvents = [event, ...(state.publicationEvents || [])]
  return event
}
