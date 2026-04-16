export const FAQ_BUILDER_UPSERT_RESOURCE = 'upsert_faq_bundle'

export const FAQ_BUILDER_BACKEND_PAYLOAD_SHAPE = Object.freeze({
  bundle_context: {
    bundle_id: 'string',
    faq_type: 'aluno|op',
    subject_key: 'string',
    title: 'string',
  },
  bundle: {
    faq_id: 'string',
    tipo_faq: 'aluno|op',
    metadata: 'object',
    versioning: 'object',
    publication: 'object',
    nodes: 'Array<node>',
    links: 'Array<link>',
    calendar_highlights: 'Array<highlight>',
  },
  canvas_snapshot: {
    viewport: '{ x: number, y: number, zoom: number }',
    node_positions: 'Record<string, { x: number, y: number }>',
    edges: 'Array<{ id: string, source: string, target: string }>',
    updated_at: 'ISO datetime',
  },
  workflow: {
    status: 'Draft|In Review|Published|Archived',
    validation_blockers: 'Array<string>',
    changed_summary: 'string',
  },
  lock: {
    editor_name: 'string',
    acquired_at: 'ISO datetime',
    last_touched_at: 'ISO datetime',
    lock_state: 'advisory_lock|hard_lock',
  },
  audit: {
    actor: 'string',
    action: 'save_draft|publish|archive|import_spreadsheet',
    at: 'ISO datetime',
  },
})

export const FAQ_BUILDER_BACKEND_ERROR_STATES = Object.freeze([
  'bundle_validation_failed',
  'canvas_snapshot_invalid',
  'workflow_transition_denied',
  'concurrent_edit_conflict',
  'publication_blocked_by_errors',
  'import_rejected_structural_error',
])

export function buildFaqBuilderUpsertPayload({
  bundleContext = {},
  bundle = {},
  canvasSnapshot = {},
  workflowStatus = 'Draft',
  validation = null,
  lockContext = {},
  actorName = 'Admin local',
  action = 'save_draft',
  currentDate = new Date(),
} = {}) {
  const blockingErrors = validation?.errors?.filter((issue) => issue.blocksPublish).map((issue) => issue.code) || []

  return {
    resource: FAQ_BUILDER_UPSERT_RESOURCE,
    bundle_context: {
      bundle_id: bundleContext.bundleId || '',
      faq_type: bundleContext.faqType || bundle?.tipo_faq || '',
      subject_key: bundleContext.subjectKey || bundle?.metadata?.subject_key || '',
      title: bundleContext.title || bundle?.metadata?.title || '',
    },
    bundle: {
      ...bundle,
    },
    canvas_snapshot: {
      viewport: { ...(canvasSnapshot.viewport || { x: 0, y: 0, zoom: 1 }) },
      node_positions: { ...(canvasSnapshot.nodePositions || {}) },
      edges: [...(canvasSnapshot.edges || [])],
      updated_at: canvasSnapshot.updatedAt || currentDate.toISOString(),
    },
    workflow: {
      status: workflowStatus,
      validation_blockers: blockingErrors,
      changed_summary: bundle?.versioning?.change_summary || '',
    },
    lock: {
      editor_name: lockContext.editorName || actorName,
      acquired_at: lockContext.acquiredAt || currentDate.toISOString(),
      last_touched_at: lockContext.lastTouchedAt || currentDate.toISOString(),
      lock_state: lockContext.lockState || 'advisory_lock',
    },
    audit: {
      actor: actorName,
      action,
      at: currentDate.toISOString(),
    },
  }
}

export function buildFaqBuilderBackendReadiness({
  hasServerUpsert = false,
  hasServerDryRun = false,
  hasServerLock = false,
} = {}) {
  return {
    hasServerUpsert,
    hasServerDryRun,
    hasServerLock,
    resource: FAQ_BUILDER_UPSERT_RESOURCE,
    payloadShape: { ...FAQ_BUILDER_BACKEND_PAYLOAD_SHAPE },
    backendErrorStates: [...FAQ_BUILDER_BACKEND_ERROR_STATES],
  }
}
