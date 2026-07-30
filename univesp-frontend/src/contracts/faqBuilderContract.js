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
    operational_owner: '{ ownerType, queueKey, areaLabel, roleKey, ownerKey, routingPolicy }',
    versioning: 'object',
    publication: 'object',
    nodes: 'Array<node com ownership por heranca/override>',
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
    ownership_coverage: '{ bundleDefaultConfigured, totalFinalNodes, effectiveFinalNodes, missingFinalNodes, invalidOverrides }',
    changed_summary: 'string',
  },
  publication_window: {
    publish_mode: 'immediate|scheduled',
    effective_start_at: 'ISO datetime|null',
    effective_end_at: 'ISO datetime|null',
    priority: 'number',
    display_rank: 'number',
    is_featured: 'boolean',
    conditions: 'string',
    supersedes_version_id: 'string',
  },
  session_binding: {
    bind_policy: 'sticky_version',
    non_interruptive_switch: 'boolean',
    active_bundle_version_id: 'string',
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
  'publication_blocked_by_missing_owner',
  'import_rejected_structural_error',
  'publication_window_invalid',
  'session_binding_conflict',
])

export function buildFaqBuilderUpsertPayload({
  bundleContext = {},
  bundle = {},
  canvasSnapshot = {},
  workflowStatus = 'Draft',
  validation = null,
  publishConfig = {},
  lockContext = {},
  actorName = 'Admin local',
  action = 'save_draft',
  currentDate = new Date(),
} = {}) {
  const blockingErrors = validation?.errors?.filter((issue) => issue.blocksPublish).map((issue) => issue.code) || []
  const ownershipCoverage = validation?.ownershipCoverage || {
    bundleDefaultConfigured: false,
    totalFinalNodes: 0,
    effectiveFinalNodes: 0,
    missingFinalNodes: 0,
    invalidOverrides: 0,
  }

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
      ownership_coverage: ownershipCoverage,
      changed_summary: bundle?.versioning?.change_summary || '',
    },
    publication_window: {
      publish_mode: publishConfig.publishMode || 'immediate',
      effective_start_at:
        publishConfig.effectiveStartAt ?? bundle?.publication?.effective_start_at ?? null,
      effective_end_at:
        publishConfig.effectiveEndAt ?? bundle?.publication?.effective_end_at ?? null,
      priority: Number(
        publishConfig.priority ?? bundle?.publication?.priority ?? 50,
      ),
      display_rank: Number(
        publishConfig.displayRank ?? bundle?.publication?.display_rank ?? 50,
      ),
      is_featured: Boolean(
        publishConfig.isFeatured ?? bundle?.publication?.is_featured ?? false,
      ),
      conditions: publishConfig.conditions ?? bundle?.publication?.conditions ?? '',
      supersedes_version_id:
        bundle?.publication?.supersedes_version_id || '',
    },
    session_binding: {
      bind_policy: 'sticky_version',
      non_interruptive_switch: true,
      active_bundle_version_id:
        bundle?.publication?.active_bundle_version_id ||
        bundle?.versioning?.bundle_version_id ||
        '',
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
