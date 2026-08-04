#!/usr/bin/env node
/* global process, Buffer */
/**
 * API mock local para preview do FAQ v3 sem bench Frappe.
 * Espelha os handlers usados nos E2E de admin-faq-library.spec.js.
 */

import { createServer } from 'node:http'
import { URL } from 'node:url'

const port = Number(process.env.DEV_MOCK_API_PORT || 8787)
const host = process.env.DEV_MOCK_API_HOST || '127.0.0.1'

const catalogs = {
  themes: [
    {
      theme_key: 'acesso-ava',
      theme_label: 'Acesso ao AVA',
      owner_email: 'gestor@univesp.br',
    },
  ],
  routing_patterns: [
    {
      pattern_key: 'op_then_area',
      label: 'OP → Área/Analista',
      steps: ['op', 'area'],
      allowed_routing_keys: ['atendimento-geral', 'sra'],
    },
  ],
}

const bundles = new Map()

const institutionalAreas = [
  {
    id: 'sra',
    area_key: 'sra',
    area_label: 'Secretaria de Registro Acadêmico',
    active: true,
    updated_at: '',
  },
]

const profileAssignments = []

function areaCatalogEntries() {
  return institutionalAreas
    .filter((area) => area.active)
    .map((area) => ({ value: area.area_key, label: area.area_label }))
}

function jsonResponse(res, status, data, etag = '') {
  const body = JSON.stringify({
    data,
    error: null,
    meta: etag ? { etag } : {},
    request_id: 'dev-mock-api',
  })
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...(etag ? { ETag: etag } : {}),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function flowPayload(bundleKey) {
  return {
    schema_version: '3.0.0',
    bundle_key: bundleKey,
    theme_key: 'acesso-ava',
    metadata: {
      title: bundleKey === 'acesso-ava' ? 'Acesso ao AVA' : 'Novo fluxo',
      audience_profile: 'student',
      operational_owner: {
        owner_type: 'queue',
        owner_key: 'atendimento-geral',
      },
      criticidade_default_key: 'media',
      sla_policy_key: '48h',
    },
    graph: {
      student_root_node_id: 'root',
      public_root_node_id: null,
      internal_root_node_id: null,
    },
    routing_policy: {
      pattern_key: 'op_then_area',
      bpo_enabled: false,
      institutional_exceptions: ['provas', 'critica'],
    },
    nodes: [
      {
        node_id: 'root',
        stable_key: 'root',
        node_kind: 'path',
        audiences: ['student'],
        display: { title: 'Início' },
        content: { student: { blocks: [] }, public: null },
        playbooks: { op: null, bpo: null, analyst: null },
        operational: { routing_override: null },
        document_policy: null,
        media_refs: [],
      },
      {
        node_id: 'final',
        stable_key: 'final',
        node_kind: 'final',
        audiences: ['student'],
        display: { title: 'Resposta final' },
        content: {
          student: { blocks: [{ type: 'paragraph', text: 'Orientação inicial publicada.' }] },
          public: null,
        },
        playbooks: {
          op: {
            objective: 'Resolver acesso',
            checklist: ['Confirmar e-mail'],
            systems: [],
            documents_to_request: [],
            suggested_reply: '',
            allowed_actions: [],
            escalation_criteria: '',
            escalation_reason_template: '',
            possible_outcomes: [],
          },
          bpo: null,
          analyst: null,
        },
        operational: { routing_override: null },
        document_policy: { mode: 'disabled' },
        media_refs: [],
      },
    ],
    edges: [
      {
        edge_id: 'root-final',
        parent_node_id: 'root',
        child_node_id: 'final',
        order: 1,
        active: true,
        audiences: ['student'],
      },
    ],
  }
}

function version(payload, revision) {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: 'draft',
    change_summary: '',
    valid_from: '',
    valid_until: '',
    etag: `"version-${revision}"`,
    payload,
  }
}

function versionSummary(revision) {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: 'draft',
    change_summary: '',
    valid_from: '',
    valid_until: '',
    etag: `"version-${revision}"`,
  }
}

function bundleResponse(payload, title, revision) {
  return {
    bundle_key: payload.bundle_key,
    title,
    theme_key: payload.theme_key,
    audience_profile: 'student',
    status: 'active',
    draft_version: 'version-1',
    published_version: '',
    draft: version(payload, revision),
  }
}

function ensureSeedBundle() {
  if (!bundles.has('acesso-ava')) {
    const payload = flowPayload('acesso-ava')
    bundles.set('acesso-ava', {
      payload,
      title: 'Acesso ao AVA',
      revision: 1,
      status: 'active',
      published_version: '',
      modified: new Date().toISOString(),
    })
  }
}

function bundleContentSummary(payload) {
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : []
  const audiences = [...new Set(
    nodes.flatMap((node) => (Array.isArray(node?.audiences) ? node.audiences : [])).filter(Boolean),
  )].sort()
  return {
    audiences,
    playbook_summary: {
      op: nodes.some((node) => Boolean(node?.playbooks?.op)),
      bpo: nodes.some((node) => Boolean(node?.playbooks?.bpo)),
      analyst: nodes.some((node) => Boolean(node?.playbooks?.analyst)),
    },
    node_count: nodes.length,
  }
}

function serializeBundleRow(bundleKey, entry) {
  const theme = catalogs.themes.find((item) => item.theme_key === entry.payload.theme_key)
  return {
    bundle_key: bundleKey,
    title: entry.title,
    theme_key: entry.payload.theme_key,
    audience_profile: entry.payload.metadata?.audience_profile || 'student',
    status: entry.status || 'active',
    draft_version: 'version-1',
    published_version: entry.published_version || '',
    owner_email: theme?.owner_email || 'gestor@univesp.br',
    draft_summary: {
      version_id: 'version-1',
      lifecycle_state: 'draft',
      valid_from: '',
      valid_until: '',
      published_at: '',
    },
    published_summary: null,
    modified: entry.modified || new Date().toISOString(),
    ...bundleContentSummary(entry.payload),
  }
}

async function handleKnowledgeV3(req, res, pathname, method) {
  ensureSeedBundle()

  if (pathname.endsWith('/catalogs') && method === 'GET') {
    return jsonResponse(res, 200, catalogs)
  }

  if (pathname.endsWith('/themes') && method === 'POST') {
    const body = await readBody(req)
    const theme = {
      theme_key: body.theme_key || 'novo-tema',
      theme_label: body.theme_label || body.name || 'Novo tema',
      owner_email: body.owner_email || 'gestor@univesp.br',
    }
    catalogs.themes.push(theme)
    return jsonResponse(res, 200, theme)
  }

  if (pathname.endsWith('/assets') && method === 'GET') {
    return jsonResponse(res, 200, [])
  }

  if (pathname.endsWith('/assets') && method === 'POST') {
    return jsonResponse(res, 200, {
      asset_id: 'asset-local-1',
      file_name: 'preview.png',
      alt_text: 'Preview local',
      url: '/crm/univesp-assets/preview.png',
    })
  }

  if (pathname.endsWith('/bundles') && method === 'GET') {
    const rows = [...bundles.entries()].map(([bundleKey, entry]) => serializeBundleRow(bundleKey, entry))
    return jsonResponse(res, 200, rows)
  }

  if (pathname.endsWith('/bundles') && method === 'POST') {
    const body = await readBody(req)
    const bundleKey = body.bundle_key || body.payload?.bundle_key
    bundles.set(bundleKey, {
      payload: body.payload,
      title: body.title || body.payload?.metadata?.title || bundleKey,
      revision: 1,
    })
    return jsonResponse(res, 200, bundleResponse(body.payload, body.title, 1))
  }

  const bundleMatch = pathname.match(/\/bundles\/([^/]+)(?:\/(.+))?$/)
  if (bundleMatch) {
    const bundleKey = decodeURIComponent(bundleMatch[1])
    const suffix = bundleMatch[2] || ''
    const entry = bundles.get(bundleKey) || {
      payload: flowPayload(bundleKey),
      title: bundleKey,
      revision: 1,
    }
    bundles.set(bundleKey, entry)

    if (suffix === 'versions' && method === 'GET') {
      return jsonResponse(res, 200, [versionSummary(entry.revision)])
    }

    if (suffix === 'draft' && method === 'PATCH') {
      const body = await readBody(req)
      entry.revision += 1
      entry.payload = body.payload
      return jsonResponse(res, 200, version(entry.payload, entry.revision), `"version-${entry.revision}"`)
    }

    if (!suffix && method === 'GET') {
      return jsonResponse(
        res,
        200,
        bundleResponse(entry.payload, entry.title, entry.revision),
        `"version-${entry.revision}"`,
      )
    }

    if (!suffix && method === 'PATCH') {
      const body = await readBody(req)
      entry.title = body.title || entry.title
      return jsonResponse(res, 200, bundleResponse(entry.payload, entry.title, entry.revision))
    }

    if (suffix === 'archive' && method === 'POST') {
      return jsonResponse(res, 200, { archived: true })
    }

    if (suffix === 'unarchive' && method === 'POST') {
      return jsonResponse(res, 200, { archived: false })
    }
  }

  return jsonResponse(res, 200, {})
}

async function handleAdmin(req, res, pathname, method) {
  if (pathname.endsWith('/admin/catalogs') && method === 'GET') {
    return jsonResponse(res, 200, {
      queues: [],
      areas: areaCatalogEntries(),
    })
  }

  if (pathname.endsWith('/admin/areas') && method === 'GET') {
    return jsonResponse(res, 200, institutionalAreas)
  }

  if (pathname.endsWith('/admin/areas') && method === 'POST') {
    const body = await readBody(req)
    const areaKey = String(body.area_key || body.area_label || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    if (!areaKey) {
      return jsonResponse(res, 422, { error: { message: 'Chave da area e obrigatoria.' } })
    }
    if (institutionalAreas.some((area) => area.area_key === areaKey)) {
      return jsonResponse(res, 409, { error: { message: 'Ja existe uma area com essa chave.' } })
    }
    const created = {
      id: areaKey,
      area_key: areaKey,
      area_label: String(body.area_label || areaKey).trim(),
      active: true,
      updated_at: new Date().toISOString(),
    }
    institutionalAreas.push(created)
    return jsonResponse(res, 200, created)
  }

  if (pathname.endsWith('/admin/users') && method === 'GET') {
    return jsonResponse(res, 200, [
      {
        email: 'op.guara@univesp.br',
        display_name: 'OP Guará',
        profile_key: 'op',
        active: true,
      },
    ])
  }

  if (pathname.endsWith('/access-groups') && method === 'GET') {
    return jsonResponse(res, 200, [])
  }

  if (pathname.endsWith('/permission-profiles') && method === 'GET') {
    return jsonResponse(res, 200, [
      {
        id: 'faq-contributor-op',
        label: 'OP que sugere melhorias',
        base_persona: 'op',
        capabilities: ['suggest_knowledge'],
      },
    ])
  }

  if (pathname.endsWith('/profile-assignments') && method === 'GET') {
    return jsonResponse(res, 200, profileAssignments)
  }

  if (pathname.endsWith('/profile-assignments') && method === 'POST') {
    const body = await readBody(req)
    const created = {
      id: `grant-local-${profileAssignments.length + 1}`,
      subject_type: body.subject_type || 'person',
      subject_id: body.subject_id || '',
      permission_profile: body.permission_profile || '',
      scopes: body.scopes || {},
      active: true,
    }
    profileAssignments.unshift(created)
    return jsonResponse(res, 200, created)
  }

  return null
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}`)
    const pathname = url.pathname
    const method = req.method || 'GET'

    if (pathname.startsWith('/api/app/v1/knowledge/v3')) {
      await handleKnowledgeV3(req, res, pathname, method)
      return
    }

    const adminResult = await handleAdmin(req, res, pathname, method)
    if (adminResult !== null) {
      return
    }

    if (pathname === '/api/me' && method === 'GET') {
      return jsonResponse(res, 401, null)
    }

    jsonResponse(res, 404, { message: `Rota mock ausente: ${method} ${pathname}` })
  } catch (error) {
    jsonResponse(res, 500, { message: error?.message || 'Erro interno do mock local.' })
  }
})

server.listen(port, host, () => {
  console.log(`[dev-mock-api] Ativo em http://${host}:${port}`)
  console.log('[dev-mock-api] FAQ v3 e rotas admin minimas disponiveis para preview local.')
})
