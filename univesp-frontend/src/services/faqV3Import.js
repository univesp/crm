const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_IMPORT_BYTES = 4 * 1024 * 1024
const NODE_COLUMNS = [
  'stable_key',
  'parent_stable_key',
  'audiences',
  'node_kind',
  'title',
  'content_student',
  'content_public',
  'playbook_op',
  'playbook_bpo',
  'playbook_analyst',
  'routing_key',
  'criticidade_key',
  'sla_policy_key',
  'document_mode',
  'outcome_key',
]

let excelJsModulePromise = null

export async function readKnowledgeV3Import(file, currentPayload) {
  if (!file) return failed('Selecione um arquivo XLSX ou JSON.')
  if (Number(file.size || 0) > MAX_IMPORT_BYTES) {
    return failed('O arquivo excede o limite de 4 MiB.')
  }
  try {
    const imported = /\.xlsx$/i.test(file.name || '')
      ? await readWorkbook(file, currentPayload)
      : normalizeJsonImport(JSON.parse(await file.text()), currentPayload)
    return buildKnowledgeV3Diff(currentPayload, imported.payload, imported.meta)
  } catch (error) {
    return failed(error?.message || 'Não foi possível interpretar o arquivo.')
  }
}

export function buildKnowledgeV3Diff(currentPayload, importedPayload, meta = {}) {
  const current = clone(currentPayload)
  const imported = clone(importedPayload)
  const errors = validateImportedPayload(imported)
  if (errors.length) return { ok: false, errors, rows: [], payload: null, meta }

  const currentByKey = indexByStableKey(current.nodes)
  const importedByKey = indexByStableKey(imported.nodes)
  const currentParents = parentKeys(current)
  const importedParents = parentKeys(imported)
  const baseHashes = parseObject(meta.field_hashes)
  const rows = []

  for (const node of imported.nodes) {
    const key = node.stable_key
    const existing = currentByKey.get(key)
    const currentHash = existing ? nodeHash(existing, currentParents.get(key)) : ''
    const importedHash = nodeHash(node, importedParents.get(key))
    const baseHash = String(baseHashes[key] || '')
    let status = 'new'
    if (existing) {
      const moved = currentParents.get(key) !== importedParents.get(key)
      const changed = currentHash !== importedHash
      const conflict = baseHash && currentHash !== baseHash && importedHash !== baseHash && currentHash !== importedHash
      status = conflict ? 'conflict' : moved ? 'moved' : changed ? 'changed' : 'unchanged'
    }
    rows.push({
      stable_key: key,
      title: node.display?.title || key,
      status,
      blocking: status === 'conflict',
      current_parent: currentParents.get(key) || '',
      imported_parent: importedParents.get(key) || '',
    })
  }

  for (const [key, node] of currentByKey) {
    if (importedByKey.has(key)) continue
    const active = current.edges.some(
      (edge) =>
        edge.active !== false &&
        [edge.parent_node_id, edge.child_node_id].includes(node.node_id),
    )
    rows.push({
      stable_key: key,
      title: node.display?.title || key,
      status: 'missing_in_import',
      blocking: active,
      resolution: '',
    })
  }

  return {
    ok: !rows.some((row) => row.status === 'conflict'),
    errors: [],
    rows,
    payload: mergeImportedPayload(current, imported, rows),
    base_payload: current,
    source_payload: imported,
    meta: {
      ...meta,
      import_mode: meta.import_mode || (Object.keys(baseHashes).length ? 'three_way' : 'two_way'),
      source_schema: meta.source_schema || imported.schema_version,
    },
    summary: summarize(rows),
  }
}

export function resolveImportConflict(diff, stableKey, resolution) {
  if (!['current', 'imported'].includes(resolution)) {
    throw new Error('Escolha manter o conteúdo atual ou usar o conteúdo importado.')
  }
  const next = clone(diff)
  const row = next.rows.find((item) => item.stable_key === stableKey)
  if (!row || row.status !== 'conflict') return next
  row.resolution = resolution
  row.blocking = false
  next.payload = mergeImportedPayload(next.base_payload, next.source_payload, next.rows)
  next.summary = summarize(next.rows)
  next.ok = !next.rows.some((item) => item.blocking)
  return next
}

export function resolveImportOrphan(diff, stableKey, resolution, remapStableKey = '') {
  const next = clone(diff)
  const row = next.rows.find((item) => item.stable_key === stableKey)
  if (!row || row.status !== 'missing_in_import') return next
  const node = next.payload.nodes.find((item) => item.stable_key === stableKey)
  if (!node) return next

  if (resolution === 'keep') {
    delete node.import_status
  } else if (resolution === 'archive') {
    const removedId = node.node_id
    next.payload.nodes = next.payload.nodes.filter((item) => item.node_id !== removedId)
    next.payload.edges = next.payload.edges.filter(
      (edge) => edge.parent_node_id !== removedId && edge.child_node_id !== removedId,
    )
  } else if (resolution === 'remap') {
    const target = next.payload.nodes.find((item) => item.stable_key === remapStableKey)
    if (!target || target.node_id === node.node_id) {
      throw new Error('Escolha uma etapa de destino válida para remapear.')
    }
    next.payload.edges = next.payload.edges.map((edge) => ({
      ...edge,
      parent_node_id: edge.parent_node_id === node.node_id ? target.node_id : edge.parent_node_id,
      child_node_id: edge.child_node_id === node.node_id ? target.node_id : edge.child_node_id,
    }))
    next.payload.edges = dedupeEdges(next.payload.edges)
    next.payload.nodes = next.payload.nodes.filter((item) => item.node_id !== node.node_id)
  } else {
    throw new Error('Escolha manter, remapear ou arquivar.')
  }
  row.resolution = resolution
  row.remap_stable_key = remapStableKey
  row.blocking = false
  next.summary = summarize(next.rows)
  next.ok = !next.rows.some((item) => item.blocking)
  return next
}

export async function downloadKnowledgeV3Template(payload) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  const metaSheet = workbook.addWorksheet('_meta')
  metaSheet.columns = [
    { header: 'key', key: 'key', width: 32 },
    { header: 'value', key: 'value', width: 90 },
  ]
  const parents = parentKeys(payload)
  const fieldHashes = Object.fromEntries(
    payload.nodes.map((node) => [node.stable_key, nodeHash(node, parents.get(node.stable_key))]),
  )
  metaSheet.addRows([
    { key: 'import_mode', value: 'three_way' },
    { key: 'export_base_version_id', value: '' },
    { key: 'export_base_revision', value: '' },
    { key: 'exported_at', value: new Date().toISOString() },
    { key: 'bundle_key', value: payload.bundle_key },
    { key: 'field_hashes', value: JSON.stringify(fieldHashes) },
  ])

  const nodesSheet = workbook.addWorksheet('nodes')
  nodesSheet.columns = NODE_COLUMNS.map((key) => ({ header: key, key, width: 28 }))
  nodesSheet.addRows(toSpreadsheetRows(payload))
  nodesSheet.views = [{ state: 'frozen', ySplit: 1 }]
  nodesSheet.autoFilter = { from: 'A1', to: 'O1' }

  const output = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([output], { type: XLSX_MIME }), `faq-v3-${payload.bundle_key}.xlsx`)
}

function normalizeJsonImport(source, currentPayload) {
  const schema = String(source.schema_version || source.schemaVersion || source.schema || '')
  if (schema === '3.0.0') {
    const payload = clone(source.payload || source.bundle || source)
    payload.bundle_key = currentPayload.bundle_key
    payload.theme_key = currentPayload.theme_key
    payload.metadata = {
      ...(payload.metadata || {}),
      title: currentPayload.metadata?.title,
      audience_profile: currentPayload.metadata?.audience_profile,
    }
    return { payload, meta: source._meta || source.meta || { source_schema: '3.0.0' } }
  }
  if (schema === 'procedure-capture-v1') {
    return {
      payload: procedureToV3(source, currentPayload),
      meta: { source_schema: 'procedure-capture-v1', import_mode: 'two_way' },
    }
  }
  const v2 = source.generatedFaqBundle || source.bundle || source
  if (Array.isArray(v2.nodes) && Array.isArray(v2.links)) {
    return {
      payload: v2ToV3(v2, currentPayload),
      meta: { source_schema: schema || '2.0.0', import_mode: 'two_way' },
    }
  }
  throw new Error('JSON deve usar schema v2, v3 ou procedure-capture-v1.')
}

async function readWorkbook(file, currentPayload) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const nodesSheet = workbook.getWorksheet('nodes')
  if (!nodesSheet) throw new Error('A planilha precisa da aba “nodes”.')
  const meta = readMetaSheet(workbook.getWorksheet('_meta'))
  if (meta.bundle_key && meta.bundle_key !== currentPayload.bundle_key) {
    throw new Error(`A planilha pertence ao fluxo “${meta.bundle_key}”.`)
  }
  const rows = worksheetRecords(nodesSheet)
  return { payload: spreadsheetToV3(rows, currentPayload), meta: { ...meta, source_schema: 'xlsx-v3' } }
}

function spreadsheetToV3(rows, currentPayload) {
  if (!rows.length) throw new Error('A aba “nodes” não possui dados.')
  const payload = clone(currentPayload)
  const currentByKey = indexByStableKey(currentPayload?.nodes)
  const nodeByKey = new Map()
  payload.nodes = rows.map((row, index) => {
    const stableKey = clean(row.stable_key)
    if (!stableKey) throw new Error(`Linha ${index + 2}: stable_key é obrigatório.`)
    if (nodeByKey.has(stableKey)) throw new Error(`stable_key duplicada: ${stableKey}.`)
    const audiences = csv(row.audiences)
    const kind = clean(row.node_kind)
    const existing = currentByKey.get(stableKey)
    const node = {
      node_id: existing?.node_id || stableKey,
      stable_key: stableKey,
      node_kind: kind,
      audiences,
      display: { title: clean(row.title) },
      content: {
        student: audiences.includes('student')
          ? content(clean(row.content_student), clean(row.outcome_key), `${stableKey}-student`)
          : null,
        public: audiences.includes('public')
          ? content(clean(row.content_public), clean(row.outcome_key), `${stableKey}-public`)
          : null,
      },
      playbooks: {
        op: parsePlaybook(row.playbook_op, `${stableKey}-op`),
        bpo: parsePlaybook(row.playbook_bpo, `${stableKey}-bpo`, true),
        analyst: parsePlaybook(row.playbook_analyst, `${stableKey}-analyst`),
      },
      operational: {
        routing_override: clean(row.routing_key) || null,
        criticidade: clean(row.criticidade_key) || null,
        sla_policy_key: clean(row.sla_policy_key) || null,
      },
      document_policy:
        kind === 'final' ? { mode: clean(row.document_mode) || 'disabled' } : null,
      media_refs: clone(existing?.media_refs || []),
    }
    nodeByKey.set(stableKey, { node, parent: clean(row.parent_stable_key) })
    return node
  })
  payload.edges = []
  payload.graph = {
    student_root_node_id: null,
    public_root_node_id: null,
    internal_root_node_id: null,
  }
  for (const [key, entry] of nodeByKey) {
    if (!entry.parent) {
      for (const audience of entry.node.audiences) {
        const graphKey = `${audience}_root_node_id`
        if (payload.graph[graphKey] && payload.graph[graphKey] !== entry.node.node_id) {
          throw new Error(`Há mais de uma raiz para ${audience}.`)
        }
        payload.graph[graphKey] = entry.node.node_id
      }
      continue
    }
    const parent = nodeByKey.get(entry.parent)?.node
    if (!parent) throw new Error(`Pai inexistente para ${key}: ${entry.parent}.`)
    const audiences = entry.node.audiences.filter((audience) => parent.audiences.includes(audience))
    payload.edges.push({
      edge_id: `${parent.node_id}-${entry.node.node_id}`,
      parent_node_id: parent.node_id,
      child_node_id: entry.node.node_id,
      order: payload.edges.filter((edge) => edge.parent_node_id === parent.node_id).length + 1,
      active: true,
      audiences,
    })
  }
  return payload
}

function v2ToV3(v2, currentPayload) {
  const payload = clone(currentPayload)
  const type = clean(v2.tipo_faq).toLowerCase()
  const audience = type === 'publico' ? 'public' : type === 'op' ? 'internal' : 'student'
  const nodeIds = new Map()
  payload.nodes = (v2.nodes || []).map((source) => {
    const stableKey = clean(source.stable_key || source.id)
    const kind = ['leaf', 'final'].includes(source.node_kind) ? 'final' : 'path'
    const response = clean(source.resposta || source.orientacao)
    const node = {
      node_id: stableKey,
      stable_key: stableKey,
      node_kind: kind,
      audiences: [audience],
      display: { title: clean(source.titulo_exibido || source.pergunta_exibida || stableKey) },
      content: {
        student: audience === 'student' ? content(response, clean(source.acao), `${stableKey}-student`) : null,
        public: audience === 'public' ? content(response, clean(source.acao), `${stableKey}-public`) : null,
      },
      playbooks: {
        op: type === 'op' ? legacyPlaybook(source, stableKey) : null,
        bpo: null,
        analyst: null,
      },
      operational: {
        routing_override: clean(source.fila_destino) || null,
        criticidade: clean(source.criticidade) || null,
        sla_policy_key: clean(source.sla_policy_key || source.sla) || null,
      },
      document_policy: kind === 'final' ? { mode: 'disabled' } : null,
      media_refs: (source.media || []).map((item, index) => ({
        asset_id: `${stableKey}-media-${index + 1}`,
        type: clean(item.type || item.media_type || 'image'),
        url: clean(item.url || item.source_url),
      })),
    }
    nodeIds.set(clean(source.id), node.node_id)
    return node
  })
  payload.edges = (v2.links || []).map((link, index) => ({
    edge_id: clean(link.link_id) || `legacy-edge-${index + 1}`,
    parent_node_id: nodeIds.get(clean(link.parent_node_id)) || clean(link.parent_node_id),
    child_node_id: nodeIds.get(clean(link.child_node_id)) || clean(link.child_node_id),
    order: Number(link.ordem || link.order || index + 1),
    active: link.ativo !== false,
    audiences: [audience],
  }))
  const children = new Set(payload.edges.map((edge) => edge.child_node_id))
  const root = payload.nodes.find((node) => !children.has(node.node_id))?.node_id || null
  payload.graph = {
    student_root_node_id: audience === 'student' ? root : null,
    public_root_node_id: audience === 'public' ? root : null,
    internal_root_node_id: audience === 'internal' ? root : null,
  }
  payload.metadata = {
    ...(payload.metadata || {}),
    title: clean(v2.metadata?.title) || payload.metadata?.title,
    audience_profile: audience === 'internal' ? 'internal' : audience === 'public' ? 'public' : 'student',
    criticidade_default_key: clean(v2.metadata?.default_criticidade) || null,
    sla_policy_key: clean(v2.metadata?.default_sla) || null,
  }
  return payload
}

function procedureToV3(source, currentPayload) {
  const procedure = { ...(source.procedure || {}), ...source }
  const title = clean(procedure.title)
  const steps = Array.isArray(source.steps) ? [...source.steps] : []
  if (!title || !steps.length) throw new Error('O procedimento precisa de título e passos.')
  const slug = slugify(procedure.id || procedure.procedure_id || title)
  const rootKey = `${slug}-inicio`
  const finalKey = `${slug}-passo-a-passo`
  const body = steps
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((step, index) => `${index + 1}. ${clean(step.action || step.instruction)}`)
    .join('\n')
  return spreadsheetToV3(
    [
      {
        stable_key: rootKey,
        parent_stable_key: '',
        audiences: 'student',
        node_kind: 'path',
        title,
      },
      {
        stable_key: finalKey,
        parent_stable_key: rootKey,
        audiences: 'student',
        node_kind: 'final',
        title: `Como fazer: ${title}`,
        content_student: body,
        playbook_op: JSON.stringify({
          objective: clean(procedure.objective || procedure.summary || title),
          checklist: steps.map((step) => clean(step.action || step.instruction)).filter(Boolean),
        }),
        routing_key: clean(procedure.owner?.id) || '',
        document_mode: 'disabled',
      },
    ],
    currentPayload,
  )
}

function mergeImportedPayload(current, imported, rows) {
  const merged = clone(current)
  const currentByKey = indexByStableKey(merged.nodes)
  const blocked = new Set(
    rows
      .filter((row) => row.status === 'conflict' && row.resolution !== 'imported')
      .map((row) => row.stable_key),
  )
  const importedIds = new Map()
  for (const source of imported.nodes) {
    const existing = currentByKey.get(source.stable_key)
    if (blocked.has(source.stable_key)) {
      importedIds.set(source.node_id, existing?.node_id || source.node_id)
      continue
    }
    const node = { ...clone(source), node_id: existing?.node_id || source.node_id }
    delete node.import_status
    importedIds.set(source.node_id, node.node_id)
    if (existing) Object.assign(existing, node)
    else merged.nodes.push(node)
  }
  const importedKeys = new Set(imported.nodes.map((node) => node.stable_key))
  merged.nodes.forEach((node) => {
    if (!importedKeys.has(node.stable_key)) node.import_status = 'missing_in_import'
  })
  const importedNodeIds = new Set(imported.nodes.map((node) => importedIds.get(node.node_id)))
  const retainedEdges = merged.edges.filter(
    (edge) =>
      !(
        importedNodeIds.has(edge.parent_node_id) &&
        importedNodeIds.has(edge.child_node_id)
      ),
  )
  const importedEdges = imported.edges.map((edge) => ({
    ...edge,
    parent_node_id: importedIds.get(edge.parent_node_id) || edge.parent_node_id,
    child_node_id: importedIds.get(edge.child_node_id) || edge.child_node_id,
  }))
  merged.edges = dedupeEdges([...retainedEdges, ...importedEdges])
  merged.graph = {
    ...merged.graph,
    ...Object.fromEntries(
      Object.entries(imported.graph || {})
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => [key, importedIds.get(value) || value]),
    ),
  }
  merged.import_metadata = {
    imported_at: new Date().toISOString(),
    unresolved_orphans: rows
      .filter((row) => row.status === 'missing_in_import')
      .map((row) => row.stable_key),
  }
  return merged
}

function validateImportedPayload(payload) {
  const errors = []
  if (payload.schema_version !== '3.0.0') errors.push('schema_version deve ser 3.0.0.')
  if (!Array.isArray(payload.nodes) || !payload.nodes.length) errors.push('A importação não possui etapas.')
  if (!Array.isArray(payload.edges)) errors.push('A importação não possui conexões.')
  const keys = new Set()
  for (const node of payload.nodes || []) {
    if (!clean(node.stable_key)) errors.push('Toda etapa precisa de stable_key.')
    else if (keys.has(node.stable_key)) errors.push(`stable_key duplicada: ${node.stable_key}.`)
    keys.add(node.stable_key)
  }
  return errors
}

function toSpreadsheetRows(payload) {
  const parents = parentKeys(payload)
  return payload.nodes.map((node) => ({
    stable_key: node.stable_key,
    parent_stable_key: parents.get(node.stable_key) || '',
    audiences: (node.audiences || []).join(','),
    node_kind: node.node_kind,
    title: node.display?.title || '',
    content_student: textContent(node.content?.student),
    content_public: textContent(node.content?.public),
    playbook_op: encodePlaybook(node.playbooks?.op),
    playbook_bpo: encodePlaybook(node.playbooks?.bpo),
    playbook_analyst: encodePlaybook(node.playbooks?.analyst),
    routing_key: node.operational?.routing_override || '',
    criticidade_key: node.operational?.criticidade || '',
    sla_policy_key: node.operational?.sla_policy_key || '',
    document_mode: node.document_policy?.mode || '',
    outcome_key: node.content?.student?.outcome_key || node.content?.public?.outcome_key || '',
  }))
}

function parsePlaybook(value, prefix, allowNull = false) {
  if (value === null || value === undefined || clean(value) === '') return allowNull ? null : null
  let source = value
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value)
    } catch {
      source = { objective: value }
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  return {
    objective: clean(source.objective),
    checklist: structuredList(source.checklist, 'checklist_item_id', 'text', `${prefix}-check`),
    systems: structuredList(source.systems, 'system_ref_id', 'system_key', `${prefix}-system`),
    documents_to_request: structuredList(
      source.documents_to_request,
      'document_ref_id',
      'document_type_key',
      `${prefix}-document`,
    ),
    suggested_reply: clean(source.suggested_reply),
    allowed_actions: structuredList(source.allowed_actions, 'action_id', 'action_key', `${prefix}-action`),
    escalation_criteria: clean(source.escalation_criteria),
    escalation_reason_template: clean(source.escalation_reason_template),
    possible_outcomes: structuredList(
      source.possible_outcomes,
      'outcome_id',
      'outcome_key',
      `${prefix}-outcome`,
    ),
  }
}

function legacyPlaybook(source, stableKey) {
  return parsePlaybook(
    {
      objective: clean(source.objetivo || source.descricao_interna || source.titulo_exibido),
      checklist: source.checklist_op || [],
      systems: source.sistemas_a_consultar || [],
      documents_to_request: source.documentos_solicitar || [],
      suggested_reply: clean(source.resposta_sugerida || source.resposta),
      allowed_actions: source.acoes_permitidas || [],
      escalation_criteria: clean(source.criterio_escalonamento),
      escalation_reason_template: clean(source.motivo_escalonamento),
      possible_outcomes: source.resultados_possiveis || [],
    },
    `${stableKey}-op`,
  )
}

function structuredList(value, idField, valueField, prefix) {
  const values = Array.isArray(value) ? value : csv(value)
  return values
    .map((item, index) => {
      if (item && typeof item === 'object') {
        const label = clean(item[valueField] || item.label || item.text)
        return { ...item, [idField]: clean(item[idField]) || `${prefix}-${index + 1}`, [valueField]: label, label }
      }
      const label = clean(item)
      return label ? { [idField]: `${prefix}-${index + 1}`, [valueField]: label, label } : null
    })
    .filter(Boolean)
}

function content(body, outcomeKey, prefix) {
  return {
    blocks: body ? [{ block_id: `${prefix}-text`, type: 'text', body }] : [],
    outcome_key: outcomeKey || '',
  }
}

function parentKeys(payload) {
  const keyById = new Map((payload.nodes || []).map((node) => [node.node_id, node.stable_key]))
  return new Map(
    (payload.edges || [])
      .filter((edge) => edge.active !== false)
      .map((edge) => [keyById.get(edge.child_node_id), keyById.get(edge.parent_node_id)]),
  )
}

function indexByStableKey(nodes = []) {
  return new Map(nodes.map((node) => [clean(node.stable_key), node]))
}

function nodeHash(node, parent) {
  const value = stableStringify({
    stable_key: clean(node.stable_key),
    parent: parent || '',
    node_kind: node.node_kind,
    audiences: [...(node.audiences || [])].sort(),
    title: clean(node.display?.title),
    content: {
      student: semanticContent(node.content?.student),
      public: semanticContent(node.content?.public),
    },
    playbooks: {
      op: semanticPlaybook(node.playbooks?.op),
      bpo: semanticPlaybook(node.playbooks?.bpo),
      analyst: semanticPlaybook(node.playbooks?.analyst),
    },
    operational: node.operational || {},
    document_policy: node.document_policy || null,
    media_refs: node.media_refs || [],
  })
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function semanticContent(layer) {
  if (!layer) return null
  return {
    text: textContent(layer),
    outcome_key: clean(layer.outcome_key),
  }
}

function semanticPlaybook(playbook) {
  if (!playbook) return null
  return {
    objective: clean(playbook.objective),
    checklist: (playbook.checklist || []).map(itemValue),
    systems: (playbook.systems || []).map(itemValue),
    documents_to_request: (playbook.documents_to_request || []).map(itemValue),
    suggested_reply: clean(playbook.suggested_reply),
    allowed_actions: (playbook.allowed_actions || []).map(itemValue),
    escalation_criteria: clean(playbook.escalation_criteria),
    escalation_reason_template: clean(playbook.escalation_reason_template),
    possible_outcomes: (playbook.possible_outcomes || []).map(itemValue),
  }
}

function itemValue(item) {
  if (typeof item !== 'object' || item === null) return clean(item)
  return clean(
    item.text ||
      item.system_key ||
      item.document_type_key ||
      item.action_key ||
      item.outcome_key ||
      item.label,
  )
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function dedupeEdges(edges) {
  const seen = new Set()
  return edges.filter((edge) => {
    const key = `${edge.parent_node_id}:${edge.child_node_id}:${(edge.audiences || []).sort().join(',')}`
    if (edge.parent_node_id === edge.child_node_id || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function worksheetRecords(sheet) {
  const headers = sheet.getRow(1).values.slice(1).map((value) => clean(excelValue(value)))
  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record = Object.fromEntries(
      headers.map((header, index) => [header, excelValue(row.getCell(index + 1).value)]).filter(([key]) => key),
    )
    if (Object.values(record).some((value) => clean(value))) rows.push(record)
  })
  return rows
}

function readMetaSheet(sheet) {
  if (!sheet) return {}
  return Object.fromEntries(
    worksheetRecords(sheet)
      .map((row) => [clean(row.key), row.value])
      .filter(([key]) => key),
  )
}

function excelValue(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  if ('text' in value) return value.text
  if ('result' in value) return value.result ?? ''
  if (Array.isArray(value.richText)) return value.richText.map((entry) => entry.text || '').join('')
  return String(value)
}

async function loadExcelJs() {
  if (!excelJsModulePromise) excelJsModulePromise = import('exceljs')
  const module = await excelJsModulePromise
  return module.default || module
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function encodePlaybook(value) {
  return value ? JSON.stringify(value) : ''
}

function textContent(value) {
  return (value?.blocks || []).filter((block) => block.type === 'text').map((block) => block.body).join('\n\n')
}

function summarize(rows) {
  const summary = {
    new: 0,
    changed: 0,
    moved: 0,
    unchanged: 0,
    missing_in_import: 0,
    conflict: 0,
    blockers: 0,
  }
  rows.forEach((row) => {
    summary[row.status] = (summary[row.status] || 0) + 1
    if (row.blocking) summary.blockers += 1
  })
  return summary
}

function parseObject(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function csv(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  return String(value || '').split(',').map(clean).filter(Boolean)
}

function slugify(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

function clean(value) {
  return String(value ?? '').trim()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

function failed(message) {
  return { ok: false, errors: [message], rows: [], payload: null, summary: null, meta: {} }
}
