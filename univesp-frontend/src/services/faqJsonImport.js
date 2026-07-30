import {
  buildAutoLayoutSnapshot,
  cloneFaqBuilderPackage,
  validateFaqBuilderBundle,
} from '@/services/faqBuilderHybridRuntime'
import { normalizeFaqMediaList } from '@/services/faqMedia'

export const FAQ_JSON_IMPORT_MAX_BYTES = 2 * 1024 * 1024

export async function readFaqBuilderJson(file, { faqType = 'aluno', baseBundle = null } = {}) {
  if (!file) return failure('missing_file', 'Selecione um arquivo JSON para iniciar o dry-run.')
  if (Number(file.size || 0) > FAQ_JSON_IMPORT_MAX_BYTES) {
    return failure('json_file_too_large', 'JSON excede o limite de 2 MiB.')
  }

  let payload
  try {
    payload = JSON.parse(await file.text())
  } catch {
    return failure('invalid_json', 'Arquivo JSON invalido ou corrompido.')
  }

  try {
    const bundle = normalizeImportedPayload(payload, { faqType, baseBundle })
    return buildJsonDryRun(bundle)
  } catch (error) {
    return failure(error?.code || 'invalid_json_contract', error?.message || 'Contrato JSON invalido.')
  }
}

export function normalizeImportedPayload(payload = {}, { faqType = 'aluno', baseBundle = null } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw contractError('invalid_json_root', 'A raiz do JSON deve ser um objeto.')
  }
  const schemaVersion = String(payload.schemaVersion || payload.schema_version || payload.schema || '').trim()
  if (schemaVersion === 'procedure-capture-v1') {
    return buildProcedureCaptureBundle(payload, { faqType, baseBundle })
  }

  const source = payload.generatedFaqBundle || payload.bundle || payload
  if (!source || typeof source !== 'object' || !Array.isArray(source.nodes) || !Array.isArray(source.links)) {
    throw contractError(
      'missing_faq_bundle',
      'Informe nodes e links, ou use generatedFaqBundle/procedure-capture-v1.',
    )
  }

  const bundle = clone(source)
  const sourceFaqType = String(bundle.tipo_faq || faqType).trim().toLowerCase()
  if (sourceFaqType !== faqType) {
    throw contractError('faq_type_mismatch', `O JSON pertence a FAQ ${sourceFaqType}, mas o fluxo aberto e ${faqType}.`)
  }
  applyDraftDefaults(bundle, { faqType, baseBundle, importSource: 'json' })
  return bundle
}

export function buildProcedureCaptureBundle(payload = {}, { faqType = 'aluno', baseBundle = null } = {}) {
  const nestedProcedure =
    payload.procedure && typeof payload.procedure === 'object' ? payload.procedure : {}
  const procedure = { ...payload, ...nestedProcedure }
  const title = String(procedure.title || '').trim()
  const steps = Array.isArray(payload.steps) ? payload.steps.filter((step) => step && typeof step === 'object') : []
  if (!title) throw contractError('missing_procedure_title', 'procedure.title e obrigatorio.')
  if (!steps.length) throw contractError('missing_procedure_steps', 'O procedimento precisa de ao menos um passo.')

  const bundle = clone(baseBundle || cloneFaqBuilderPackage(faqType))
  const slug = slugify(procedure.id || procedure.procedure_id || title) || `procedimento-${Date.now()}`
  const pathTemplate = bundle.nodes.find((node) => node?.node_kind !== 'leaf') || bundle.nodes[0] || {}
  const finalTemplate = bundle.nodes.find((node) => node?.node_kind === 'leaf') || bundle.nodes.at(-1) || {}
  const theme = String(procedure.theme || procedure.system || 'orientacao').trim().toLowerCase()
  const subtheme = String(procedure.subtheme || slug).trim().toLowerCase()
  const rootId = `${slug}-inicio`
  const answerId = `${slug}-passo-a-passo`
  const answer = steps
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((step, index) => {
      const action = String(step.action || step.instruction || '').trim()
      const narration = String(step.narration || step.notes || '').trim()
      const expected = String(step.expectedResult || step.expected_result || '').trim()
      return `${index + 1}. ${[action, narration, expected ? `Resultado esperado: ${expected}` : ''].filter(Boolean).join(' ')}`
    })
    .join('\n')
  const media = collectProcedureMedia(payload)

  bundle.nodes = [
    {
      ...clone(pathTemplate),
      id: rootId,
      tipo_faq: faqType,
      perfil: faqType,
      node_kind: 'theme',
      tema: theme,
      subtema: subtheme,
      titulo_exibido: title,
      pergunta_exibida: title,
      descricao_interna: String(procedure.objective || procedure.summary || '').trim(),
      resposta: '',
      acao: 'ir_para_subniveis',
      abre_atendimento: false,
      ordem: 1,
      ativo: true,
      publication_status: 'draft',
      media: [],
    },
    {
      ...clone(finalTemplate),
      id: answerId,
      tipo_faq: faqType,
      perfil: faqType,
      node_kind: 'leaf',
      tema: theme,
      subtema: subtheme,
      titulo_exibido: `Como fazer: ${title}`,
      pergunta_exibida: `Como realizar ${title}?`,
      descricao_interna: String(procedure.objective || procedure.summary || '').trim(),
      resposta: answer,
      acao: 'mostrar_resposta',
      abre_atendimento: false,
      ordem: 1,
      ativo: true,
      publication_status: 'draft',
      media,
    },
  ]
  bundle.links = [
    {
      link_id: `link-${rootId}-${answerId}`,
      faq_id: bundle.faq_id || `faq-${faqType}`,
      parent_node_id: rootId,
      child_node_id: answerId,
      ordem: 1,
      ativo: true,
    },
  ]
  bundle.calendar_highlights = []
  bundle.metadata = {
    ...(bundle.metadata || {}),
    title,
    source_procedure_id: String(procedure.id || procedure.procedure_id || '').trim(),
    source_capture_checksum: String(payload.checksum || '').trim(),
  }
  applyProcedureOwner(bundle, payload.owner || procedure.owner)
  applyDraftDefaults(bundle, { faqType, baseBundle, importSource: 'procedure-capture-json' })
  return bundle
}

function applyProcedureOwner(bundle, owner) {
  if (!owner || typeof owner !== 'object') return
  const ownerType = String(owner.type || owner.ownerType || '').trim().toLowerCase()
  const ownerId = String(owner.id || owner.ownerId || '').trim()
  if (ownerType !== 'queue' || !ownerId) return

  bundle.operational_owner = {
    ...(bundle.operational_owner || {}),
    ownerType: 'queue',
    queueKey: ownerId,
    areaLabel: '',
    roleKey: '',
    ownerKey: `queue:${ownerId}`,
  }
  bundle.metadata = {
    ...(bundle.metadata || {}),
    operational_owner: clone(bundle.operational_owner),
  }
  bundle.nodes = bundle.nodes.map((node) => ({ ...node, fila_destino: ownerId }))
}

function buildJsonDryRun(bundle) {
  const validation = validateFaqBuilderBundle(bundle, { mode: 'import' })
  const issues = validation.issues
  const errors = issues.filter((issue) => issue.severity === 'error').map(toImportIssue)
  const warnings = issues.filter((issue) => issue.severity === 'warning').map(toImportIssue)
  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      summary: summary(bundle),
      draftBundle: null,
      canvasSnapshot: null,
    }
  }
  return {
    ok: true,
    errors: [],
    warnings,
    summary: summary(bundle),
    draftBundle: bundle,
    canvasSnapshot: buildAutoLayoutSnapshot(bundle),
  }
}

function applyDraftDefaults(bundle, { faqType, baseBundle, importSource }) {
  bundle.tipo_faq = faqType
  bundle.faq_id = String(bundle.faq_id || baseBundle?.faq_id || `faq-${faqType}`).trim()
  bundle.schema_version = String(bundle.schema_version || '2.0.0')
  bundle.metadata = bundle.metadata && typeof bundle.metadata === 'object' ? bundle.metadata : {}
  bundle.operational_owner = bundle.operational_owner || clone(baseBundle?.operational_owner || {})
  bundle.publication = bundle.publication && typeof bundle.publication === 'object' ? bundle.publication : {}
  bundle.versioning = bundle.versioning && typeof bundle.versioning === 'object' ? bundle.versioning : {}
  bundle.versioning.publication_status = 'draft'
  bundle.versioning.import_source = importSource
  bundle.versioning.change_summary = `Importacao ${importSource} validada em dry-run.`
  bundle.publication.last_published_at = null
  bundle.publication.last_published_by = ''
  bundle.nodes = bundle.nodes.map((node) => ({ ...node, media: normalizeFaqMediaList(node?.media) }))
  bundle.links = bundle.links.map((link) => ({ ...link }))
  bundle.calendar_highlights = Array.isArray(bundle.calendar_highlights) ? bundle.calendar_highlights : []
}

function collectProcedureMedia(payload) {
  const candidates = [
    ...(Array.isArray(payload.sources) ? payload.sources : []),
    ...(Array.isArray(payload.steps) ? payload.steps.flatMap((step) => step?.media || []) : []),
  ]
  return normalizeFaqMediaList(candidates)
}

function summary(bundle) {
  return {
    totalRows: bundle.nodes.length,
    validRows: bundle.nodes.length,
    totalNodes: bundle.nodes.length,
    totalLinks: bundle.links.length,
    mediaItems: bundle.nodes.reduce((total, node) => total + (node.media?.length || 0), 0),
  }
}

function failure(code, message) {
  return {
    ok: false,
    errors: [{ row: null, field: 'file', code, message, severity: 'error' }],
    warnings: [],
    summary: null,
    draftBundle: null,
    canvasSnapshot: null,
  }
}

function toImportIssue(issue) {
  return {
    row: null,
    field: issue.nodeId || issue.field || '',
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
  }
}

function contractError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}