import { adminPermissionsDraft } from '../../mocks/adminPermissions'
import { mockAccessProfiles } from '../../mocks/mockAccessProfiles'
import { buildPoloQueueLabel } from '@/services/caseRoutingRuntime'

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
  polo: Object.freeze({ label: 'Um polo' }),
  multi_polo: Object.freeze({ label: 'Multi-polo' }),
  fila: Object.freeze({ label: 'Uma fila' }),
  multi_fila: Object.freeze({ label: 'Multi-fila' }),
  area: Object.freeze({ label: 'Uma area' }),
  multi_area: Object.freeze({ label: 'Multi-area' }),
  global: Object.freeze({ label: 'Global' }),
})

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
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

function buildPoloCatalog(dashboardData) {
  const polos = uniqueBy([
    ...(dashboardData?.activeCases || []).map((entry) => entry.polo),
    ...mockAccessProfiles.flatMap((profile) => profile.linkedPolos || []),
  ])

  return polos.map((polo) => ({
    id: polo,
    label: polo,
  }))
}

function buildAreaCatalog(areas = [], queues = []) {
  const queueSet = new Set(queues.map((queue) => queue.id))

  return [...areas].map((area) => ({
    ...area,
    queues: (area.queues || []).filter((queue) => queueSet.has(queue)),
  }))
}

function buildAreaMap(areas = []) {
  return Object.fromEntries(areas.map((area) => [area.id, area]))
}

function buildProfileMap(profiles = []) {
  return Object.fromEntries(profiles.map((profile) => [profile.key, profile]))
}

function buildPoloQueueMap(activeCases = []) {
  const map = new Map()

  for (const entry of activeCases) {
    if (!entry.polo) {
      continue
    }

    if (!map.has(entry.polo)) {
      map.set(entry.polo, new Set())
    }

    map.get(entry.polo).add(entry.queue)
  }

  return map
}

function resolveAreaLabelsFromQueues(queues = [], allAreas = []) {
  return uniqueBy(
    allAreas
      .filter((area) => area.queues.some((queue) => queues.includes(queue)))
      .map((area) => area.label),
  )
}

function resolveQueuesForPolos(scopeValues = [], poloQueueMap = new Map()) {
  return uniqueBy(
    scopeValues.flatMap((polo) => {
      const mappedQueues = [...(poloQueueMap.get(polo) || [])]
      return mappedQueues.length ? mappedQueues : [buildPoloQueueLabel(polo)]
    }),
  )
}

function resolveScope(entry, { areaMap, allAreas, poloQueueMap }) {
  const scopeType = entry.scopeType
  const scopeValues = entry.scopeValues || []

  if (scopeType === 'polo') {
    const visiblePolos = scopeValues.slice(0, 1)
    const visibleQueues = resolveQueuesForPolos(visiblePolos, poloQueueMap)

    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.polo.label,
      visiblePolos,
      visibleQueues,
      areaLabels: resolveAreaLabelsFromQueues(visibleQueues, allAreas),
    }
  }

  if (scopeType === 'multi_polo') {
    const visibleQueues = resolveQueuesForPolos(scopeValues, poloQueueMap)

    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.multi_polo.label,
      visiblePolos: scopeValues,
      visibleQueues,
      areaLabels: resolveAreaLabelsFromQueues(visibleQueues, allAreas),
    }
  }

  if (scopeType === 'fila') {
    const visibleQueues = scopeValues.slice(0, 1)

    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.fila.label,
      visiblePolos: [],
      visibleQueues,
      areaLabels: resolveAreaLabelsFromQueues(visibleQueues, allAreas),
    }
  }

  if (scopeType === 'multi_fila') {
    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.multi_fila.label,
      visiblePolos: [],
      visibleQueues: scopeValues,
      areaLabels: resolveAreaLabelsFromQueues(scopeValues, allAreas),
    }
  }

  if (scopeType === 'area') {
    const area = areaMap[scopeValues[0]]

    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.area.label,
      visiblePolos: [],
      visibleQueues: area?.queues || [],
      areaLabels: area ? [area.label] : [],
    }
  }

  if (scopeType === 'multi_area') {
    const selectedAreas = scopeValues.map((areaId) => areaMap[areaId]).filter(Boolean)

    return {
      scopeLabel: PERMISSION_SCOPE_CATALOG.multi_area.label,
      visiblePolos: [],
      visibleQueues: uniqueBy(selectedAreas.flatMap((area) => area.queues || [])),
      areaLabels: selectedAreas.map((area) => area.label),
    }
  }

  return {
    scopeLabel: PERMISSION_SCOPE_CATALOG.global.label,
    visiblePolos: uniqueBy([...poloQueueMap.keys()]),
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

function buildMatrixEntry(entry, profileMap, scopeContext) {
  const scope = resolveScope(entry, scopeContext)
  const allowedActions = buildAllowedActions(entry.allowedActions)
  const profile = profileMap[entry.profileKey]

  return {
    ...entry,
    profileLabel: profile?.label || entry.profileKey,
    scopeLabel: scope.scopeLabel,
    visiblePolos: scope.visiblePolos,
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
  const visiblePolos = uniqueBy(entries.flatMap((entry) => entry.visiblePolos))
  const visibleQueues = uniqueBy(entries.flatMap((entry) => entry.visibleQueues))
  const administeredAreas = uniqueBy(entries.flatMap((entry) => entry.administeredAreas))
  const allowedActions = uniqueBy(entries.flatMap((entry) => entry.allowedActionLabels))

  return {
    ...profile,
    totalPolicies: entries.length,
    visiblePolos,
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
    changes.push('alcance')
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
  const polos = buildPoloCatalog(dashboardData)
  const areas = buildAreaCatalog(draft?.areas || [], queues)
  const areaMap = buildAreaMap(areas)
  const profileMap = buildProfileMap(profiles)
  const poloQueueMap = buildPoloQueueMap(dashboardData?.activeCases || [])
  const scopeContext = {
    areaMap,
    allAreas: areas,
    poloQueueMap,
  }
  const matrixEntries = (draft?.matrix || []).map((entry) =>
    buildMatrixEntry(entry, profileMap, scopeContext),
  )
  const profileImpacts = profiles.map((profile) => buildProfileImpact(profile, matrixEntries))
  const queueVisibility = buildQueueVisibility(matrixEntries, queues)
  const auditLogs = draft?.auditLogs || []

  return {
    profiles,
    areas,
    polos,
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
      polos: polos.map((polo) => ({
        value: polo.id,
        label: polo.label,
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
