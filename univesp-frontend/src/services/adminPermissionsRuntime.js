import { adminPermissionsDraft } from '../../mocks/adminPermissions'

export const PERMISSION_ACTION_CATALOG = Object.freeze({
  view_case: Object.freeze({
    label: 'Visualizar caso',
    governance: false,
  }),
  reply: Object.freeze({
    label: 'Responder',
    governance: false,
  }),
  request_info: Object.freeze({
    label: 'Solicitar complementacao',
    governance: false,
  }),
  escalate: Object.freeze({
    label: 'Escalar',
    governance: false,
  }),
  reassign: Object.freeze({
    label: 'Reatribuir',
    governance: true,
  }),
  edit_faq: Object.freeze({
    label: 'Editar FAQ',
    governance: true,
  }),
  edit_parameters: Object.freeze({
    label: 'Editar parametros',
    governance: true,
  }),
  publish_version: Object.freeze({
    label: 'Publicar versao',
    governance: true,
  }),
  view_audit: Object.freeze({
    label: 'Visualizar auditoria',
    governance: true,
  }),
})

export const PERMISSION_SCOPE_CATALOG = Object.freeze({
  queue: Object.freeze({ label: 'Uma fila' }),
  area: Object.freeze({ label: 'Uma area' }),
  areas: Object.freeze({ label: 'Multiplas areas' }),
  all_areas: Object.freeze({ label: 'Todas as areas' }),
})

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase()
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

function uniqueBy(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function buildQueueCatalog(dashboardData, areas = []) {
  const queueNames = uniqueBy([
    ...(dashboardData?.activeCases || []).map((entry) => entry.queue),
    ...areas.flatMap((area) => area.queues || []),
  ])

  return queueNames.map((queue) => ({
    id: queue,
    label: queue,
  }))
}

function buildAreaCatalog(areas = [], queues = []) {
  const queueSet = new Set(queues.map((queue) => queue.id))
  const catalog = [...areas].map((area) => ({
    ...area,
    queues: (area.queues || []).filter((queue) => queueSet.has(queue)),
  }))

  for (const queue of queues) {
    const alreadyMapped = catalog.some((area) => area.queues.includes(queue.id))

    if (!alreadyMapped) {
      catalog.push({
        id: `dynamic-${normalizeText(queue.id).replaceAll(' ', '-')}`,
        label: queue.label,
        queues: [queue.id],
      })
    }
  }

  return catalog
}

function buildAreaMap(areas = []) {
  return Object.fromEntries(areas.map((area) => [area.id, area]))
}

function buildProfileMap(profiles = []) {
  return Object.fromEntries(profiles.map((profile) => [profile.key, profile]))
}

function resolveScope(entry, areaMap, allAreas = []) {
  const scopeType = entry.scopeType
  const scopeValues = entry.scopeValues || []

  if (scopeType === 'queue') {
    return {
      scopeLabel: 'Uma fila',
      visibleQueues: scopeValues,
      areaLabels: uniqueBy(
        allAreas
          .filter((area) => area.queues.some((queue) => scopeValues.includes(queue)))
          .map((area) => area.label),
      ),
    }
  }

  if (scopeType === 'area') {
    const area = areaMap[scopeValues[0]]

    return {
      scopeLabel: 'Uma area',
      visibleQueues: area?.queues || [],
      areaLabels: area ? [area.label] : [],
    }
  }

  if (scopeType === 'areas') {
    const areas = scopeValues.map((areaId) => areaMap[areaId]).filter(Boolean)

    return {
      scopeLabel: 'Multiplas areas',
      visibleQueues: uniqueBy(areas.flatMap((area) => area.queues || [])),
      areaLabels: areas.map((area) => area.label),
    }
  }

  return {
    scopeLabel: 'Todas as areas',
    visibleQueues: uniqueBy(allAreas.flatMap((area) => area.queues || [])),
    areaLabels: allAreas.map((area) => area.label),
  }
}

function buildAllowedActions(allowedActions = {}) {
  return Object.entries(PERMISSION_ACTION_CATALOG)
    .filter(([key]) => Boolean(allowedActions[key]))
    .map(([key, metadata]) => ({
      key,
      label: metadata.label,
      governance: metadata.governance,
    }))
}

function buildGovernedAreas(areaLabels = [], allowedActions = []) {
  const hasGovernanceAction = allowedActions.some((action) => action.governance)
  return hasGovernanceAction ? areaLabels : []
}

function buildMatrixEntry(entry, profileMap, areaMap, allAreas) {
  const scope = resolveScope(entry, areaMap, allAreas)
  const allowedActions = buildAllowedActions(entry.allowedActions)
  const profile = profileMap[entry.profileKey]

  return {
    ...entry,
    profileLabel: profile?.label || entry.profileKey,
    scopeLabel: scope.scopeLabel,
    visibleQueues: scope.visibleQueues,
    visibleQueueCount: scope.visibleQueues.length,
    areaLabels: scope.areaLabels,
    administeredAreas: buildGovernedAreas(scope.areaLabels, allowedActions),
    allowedActionList: allowedActions,
    allowedActionLabels: allowedActions.map((action) => action.label),
  }
}

function buildProfileImpact(profile, matrixEntries = []) {
  const entries = matrixEntries.filter((entry) => entry.profileKey === profile.key)
  const visibleQueues = uniqueBy(entries.flatMap((entry) => entry.visibleQueues))
  const administeredAreas = uniqueBy(entries.flatMap((entry) => entry.administeredAreas))
  const allowedActions = uniqueBy(entries.flatMap((entry) => entry.allowedActionLabels))

  return {
    ...profile,
    totalPolicies: entries.length,
    visibleQueues,
    administeredAreas,
    allowedActions,
  }
}

function buildQueueVisibility(matrixEntries = [], queues = []) {
  return queues
    .map((queue) => {
      const viewerEntries = matrixEntries.filter((entry) => entry.visibleQueues.includes(queue.label))

      return {
        queue: queue.label,
        profiles: uniqueBy(viewerEntries.map((entry) => entry.profileLabel)),
        governanceProfiles: uniqueBy(
          viewerEntries
            .filter((entry) => entry.administeredAreas.length > 0)
            .map((entry) => entry.profileLabel),
        ),
      }
    })
    .sort((left, right) => right.profiles.length - left.profiles.length)
}

function summarizeDiff(before, after) {
  const changes = []

  if (before.profileKey !== after.profileKey) {
    changes.push('perfil')
  }

  if (before.scopeType !== after.scopeType) {
    changes.push('escopo')
  }

  if (JSON.stringify(before.scopeValues) !== JSON.stringify(after.scopeValues)) {
    changes.push('fila/area')
  }

  if (JSON.stringify(before.allowedActions) !== JSON.stringify(after.allowedActions)) {
    changes.push('acoes')
  }

  if (before.note !== after.note) {
    changes.push('nota')
  }

  return changes.length ? `Atualizou ${changes.join(', ')}.` : 'Nenhuma mudanca detectada.'
}

export function cloneAdminPermissionsDraft() {
  return cloneJson(adminPermissionsDraft)
}

export function findPermissionEntry(matrix = [], entryId) {
  return matrix.find((entry) => entry.id === entryId) || null
}

export function buildPermissionForm(entry) {
  return cloneJson(entry)
}

export function applyPermissionEntryUpdate({
  draft,
  entryId,
  nextEntry,
  actor,
  currentDate = new Date(),
}) {
  const entry = findPermissionEntry(draft.matrix, entryId)

  if (!entry) {
    return null
  }

  const before = cloneJson(entry)

  entry.profileKey = nextEntry.profileKey
  entry.scopeType = nextEntry.scopeType
  entry.scopeValues = cloneJson(nextEntry.scopeValues || [])
  entry.allowedActions = cloneJson(nextEntry.allowedActions || {})
  entry.note = nextEntry.note || ''

  const after = cloneJson(entry)
  const timestamp = formatTimestamp(currentDate)
  const auditLog = {
    id: `perm-audit-${timestamp.compact}`,
    actorName: actor.name,
    actorRole: actor.role,
    targetEntryId: entry.id,
    changedAt: timestamp.iso,
    changedAtLabel: timestamp.label,
    summary: summarizeDiff(before, after),
    before,
    after,
  }

  draft.auditLogs = [auditLog, ...draft.auditLogs]

  return auditLog
}

export function buildAdminPermissionsRuntime({ dashboardData, draft }) {
  const profiles = draft?.profiles || []
  const queues = buildQueueCatalog(dashboardData, draft?.areas || [])
  const areas = buildAreaCatalog(draft?.areas || [], queues)
  const areaMap = buildAreaMap(areas)
  const profileMap = buildProfileMap(profiles)
  const matrixEntries = (draft?.matrix || []).map((entry) =>
    buildMatrixEntry(entry, profileMap, areaMap, areas),
  )
  const profileImpacts = profiles.map((profile) => buildProfileImpact(profile, matrixEntries))
  const queueVisibility = buildQueueVisibility(matrixEntries, queues)
  const auditLogs = draft?.auditLogs || []

  return {
    profiles,
    areas,
    queues,
    matrixEntries,
    profileImpacts,
    queueVisibility,
    auditLogs,
    metrics: [
      {
        label: 'Perfis governados',
        value: profiles.length,
        hint: 'Perfis operacionais e de gestao mapeados na matriz mockada.',
      },
      {
        label: 'Politicas ativas',
        value: matrixEntries.length,
        hint: 'Entradas de permissao em vigor por perfil e escopo.',
      },
      {
        label: 'Filas visiveis',
        value: queueVisibility.filter((entry) => entry.profiles.length > 0).length,
        hint: 'Filas que ficam expostas a pelo menos um perfil nesta leitura.',
      },
      {
        label: 'Auditoria admin',
        value: auditLogs.length,
        hint: 'Mudancas de permissao registradas em modo mock.',
      },
    ],
    catalogs: {
      actions: Object.entries(PERMISSION_ACTION_CATALOG).map(([value, metadata]) => ({
        value,
        label: metadata.label,
        governance: metadata.governance,
      })),
      scopeTypes: Object.entries(PERMISSION_SCOPE_CATALOG).map(([value, metadata]) => ({
        value,
        label: metadata.label,
      })),
      profiles: profiles.map((profile) => ({
        value: profile.key,
        label: profile.label,
      })),
      areas: areas.map((area) => ({
        value: area.id,
        label: area.label,
      })),
      queues: queues.map((queue) => ({
        value: queue.label,
        label: queue.label,
      })),
    },
  }
}
