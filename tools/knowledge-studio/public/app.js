const state = {
  runs: [],
  activeRunId: null,
  activeRun: null,
  activePackage: null,
  activeItemIndex: 0,
}

const STEPS = [
  { id: 'crawl', label: 'Capturar fontes', help: 'Manual + páginas + documentos/link.' },
  { id: 'faq_candidates', label: 'Gerar perguntas FAQ', help: 'Importe CSV de tickets ou use intenções-semente.' },
  { id: 'ai_analysis', label: 'IA preencher respostas (opcional)', help: 'Export jobs → prompt externo → import JSON.' },
  { id: 'studio_review', label: 'Curadoria', help: 'Edite respostas com base nas fontes e aprove.' },
  { id: 'export_faq', label: 'Exportar XLSX', help: 'Só itens aprovados vão para o FAQ Builder.' },
]

const ORIGIN_LABELS = {
  ticket: '150k tickets',
  starter_intent: 'intenção-semente',
  ai_new: 'IA (nova pergunta)',
  ai: 'IA',
}

const el = {
  runsList: document.getElementById('runsList'),
  stepsList: document.getElementById('stepsList'),
  nextStepCard: document.getElementById('nextStepCard'),
  emptyState: document.getElementById('emptyState'),
  runPanel: document.getElementById('runPanel'),
  runTitle: document.getElementById('runTitle'),
  runMeta: document.getElementById('runMeta'),
  runActions: document.getElementById('runActions'),
  packagesGrid: document.getElementById('packagesGrid'),
  reviewPanel: document.getElementById('reviewPanel'),
  reviewTitle: document.getElementById('reviewTitle'),
  reviewProgress: document.getElementById('reviewProgress'),
  reviewHint: document.getElementById('reviewHint'),
  itemNav: document.getElementById('itemNav'),
  sourceRefs: document.getElementById('sourceRefs'),
  documentRefs: document.getElementById('documentRefs'),
  originBadge: document.getElementById('originBadge'),
  suggestedTitleInput: document.getElementById('suggestedTitleInput'),
  suggestedAnswerInput: document.getElementById('suggestedAnswerInput'),
  aiInsights: document.getElementById('aiInsights'),
  reviewNotesInput: document.getElementById('reviewNotesInput'),
  faqPreview: document.getElementById('faqPreview'),
  exportStatus: document.getElementById('exportStatus'),
  toast: document.getElementById('toast'),
  pinInput: document.getElementById('pinInput'),
  guideBody: document.getElementById('guideBody'),
}

function pin() {
  return el.pinInput.value.trim()
}

function headers(extra = {}) {
  const base = { ...extra }
  const value = pin()
  if (value) base['x-studio-pin'] = value
  return base
}

function toast(message) {
  el.toast.textContent = message
  el.toast.classList.remove('hidden')
  setTimeout(() => el.toast.classList.add('hidden'), 3500)
}

async function api(path, options = {}) {
  const rel = String(path || '').replace(/^\/?api\//, 'api/')
  const response = await fetch(rel, {
    ...options,
    headers: headers(options.headers || {}),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload
}

function getCandidates(pkg) {
  return pkg?.faq_candidates || pkg?.items || []
}

function getSources(pkg) {
  return pkg?.source_items || []
}

function candidateId(item) {
  return item.candidate_id || item.item_id
}

function stepStatus(manifest, stepId) {
  return manifest?.steps?.[stepId]?.status || 'pending'
}

function packageProgress(pkg) {
  const items = getCandidates(pkg)
  const approved = items.filter((item) => item.review?.approved).length
  const rejected = items.filter((item) => item.review?.status === 'rejected').length
  return { approved, rejected, total: items.length }
}

function totalApproved(packages) {
  return (packages || []).reduce((sum, pkg) => sum + packageProgress(pkg).approved, 0)
}

function totalCandidates(packages) {
  return (packages || []).reduce((sum, pkg) => sum + getCandidates(pkg).length, 0)
}

function resolveNextStep(manifest, packages) {
  if (!manifest) return STEPS[0]
  if (stepStatus(manifest, 'crawl') !== 'completed') return STEPS[0]
  if (totalCandidates(packages) === 0) return STEPS[1]
  if (stepStatus(manifest, 'ai_analysis') === 'in_progress') return STEPS[2]
  if (totalApproved(packages) === 0) return STEPS[3]
  if (stepStatus(manifest, 'export_faq') !== 'completed') return STEPS[4]
  return null
}

function renderSteps(manifest, packages) {
  el.stepsList.innerHTML = ''
  const next = resolveNextStep(manifest, packages)
  for (const step of STEPS) {
    const li = document.createElement('li')
    const status = stepStatus(manifest, step.id)
    const isCurrent = next?.id === step.id
    li.className = `step-item${isCurrent ? ' current' : ''}${status === 'completed' ? ' done' : ''}`
    li.innerHTML = `
      <strong>${step.label}</strong>
      <span class="step-status">${status === 'completed' ? 'ok' : isCurrent ? 'agora' : '…'}</span>
      <p>${step.help}</p>
    `
    el.stepsList.appendChild(li)
  }

  if (!next) {
    el.nextStepCard.innerHTML = '<p><strong>Pronto!</strong> Importe o XLSX no FAQ Builder.</p>'
    return
  }
  el.nextStepCard.innerHTML = `
    <p class="next-step-label">Agora</p>
    <p><strong>${next.label}</strong></p>
    <p>${next.help}</p>
  `
}

function renderRunActions(manifest, packages) {
  el.runActions.innerHTML = ''
  const next = resolveNextStep(manifest, packages)
  const defs = [
    { id: 'crawl', label: '1. Crawler (fontes)', fn: runCrawl, primary: next?.id === 'crawl' },
    { id: 'tickets', label: '2. Importar tickets CSV', file: true, accept: '.csv', fn: importTickets },
    { id: 'jobs', label: '3. Export jobs IA', fn: exportJobs, primary: next?.id === 'ai_analysis' },
    { id: 'analysis', label: '4. Import análises IA', file: true, accept: '.json', fn: importAnalysis, multiple: true },
    { id: 'xlsx', label: '5. Export XLSX', fn: exportXlsx, primary: next?.id === 'export_faq' },
  ]

  for (const def of defs) {
    if (def.file) {
      const label = document.createElement('label')
      label.className = `btn file-btn${def.primary ? ' primary' : ''}`
      label.textContent = def.label
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = def.accept
      input.hidden = true
      if (def.multiple) input.multiple = true
      input.onchange = def.fn
      label.appendChild(input)
      el.runActions.appendChild(label)
    } else {
      const btn = document.createElement('button')
      btn.className = `btn${def.primary ? ' primary' : ''}`
      btn.type = 'button'
      btn.textContent = def.label
      btn.onclick = def.fn
      el.runActions.appendChild(btn)
    }
  }
}

function renderRuns() {
  el.runsList.innerHTML = ''
  for (const run of state.runs) {
    const card = document.createElement('div')
    card.className = `run-card${run.run_id === state.activeRunId ? ' active' : ''}`
    card.innerHTML = `
      <strong>${run.run_id}</strong>
      <span>${run.manifest?.faq_candidate_count || '?'} perguntas FAQ</span>
      <span>${run.manifest?.document_count || 0} docs · ${run.manifest?.chunk_count || 0} trechos</span>
    `
    card.onclick = () => selectRun(run.run_id)
    el.runsList.appendChild(card)
  }
}

function renderPackages() {
  const packages = (state.activeRun?.packages || []).filter(
    (pkg) => getCandidates(pkg).length > 0 || pkg.chunk_count > 0,
  )
  el.packagesGrid.innerHTML = ''
  if (!packages.length) {
    el.packagesGrid.innerHTML = '<p class="muted-inline">Rode o crawler e importe tickets CSV.</p>'
    return
  }
  for (const pkg of packages) {
    const { approved, rejected, total } = packageProgress(pkg)
    const pct = total ? Math.round((approved / total) * 100) : 0
    const sources = getSources(pkg).length
    const docs = pkg.document_count || (pkg.documents || []).length
    const card = document.createElement('article')
    card.className = 'package-card'
    card.innerHTML = `
      <h3>${pkg.title}</h3>
      <p>${pkg.description || ''}</p>
      <p class="package-stats">
        <strong>${total}</strong> pergunta(s) FAQ ·
        <strong>${sources}</strong> trecho(s) manual ·
        <strong>${docs}</strong> documento(s)/link(s)
      </p>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <p class="package-progress">${approved} aprovada(s) · ${rejected} descartada(s)</p>
      <button class="btn primary" type="button">Curar perguntas</button>
    `
    card.querySelector('button').onclick = () => openPackage(pkg)
    el.packagesGrid.appendChild(card)
  }
}

function renderRunPanel() {
  if (!state.activeRun) {
    el.emptyState.classList.remove('hidden')
    el.runPanel.classList.add('hidden')
    return
  }
  el.emptyState.classList.add('hidden')
  el.runPanel.classList.remove('hidden')
  const manifest = state.activeRun.manifest || {}
  const packages = state.activeRun.packages || []
  el.runTitle.textContent = `Execução ${state.activeRunId}`
  el.runMeta.textContent = [
    `${totalCandidates(packages)} perguntas FAQ`,
    `${manifest.document_count || 0} documentos`,
    `${manifest.chunk_count || 0} trechos manual`,
    manifest.tickets_imported ? 'tickets importados' : 'sem CSV de tickets ainda',
  ].join(' · ')
  renderSteps(manifest, packages)
  renderRunActions(manifest, packages)
  renderPackages()
}

function renderItemNav() {
  const pkg = state.activePackage
  if (!pkg) return
  el.itemNav.innerHTML = '<p class="item-nav-title">Perguntas deste tema</p>'
  const list = document.createElement('ul')
  for (const [index, item] of getCandidates(pkg).entries()) {
    const approved = item.review?.approved
    const rejected = item.review?.status === 'rejected'
    const status = approved ? 'aprovado' : rejected ? 'descartado' : 'pendente'
    const li = document.createElement('li')
    li.className = `item-nav-item${index === state.activeItemIndex ? ' active' : ''} status-${status}`
    const ticket = item.ticket_count ? ` (${item.ticket_count}x)` : ''
    li.innerHTML = `
      <span class="item-nav-status">${status}</span>
      <span class="item-nav-label">${item.question || item.suggested_title || 'Sem título'}${ticket}</span>
    `
    li.onclick = () => {
      state.activeItemIndex = index
      renderReviewItem()
    }
    list.appendChild(li)
  }
  el.itemNav.appendChild(list)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderSourceRefs(pkg, candidate) {
  const sources = getSources(pkg)
  const refs = candidate.source_refs || []
  const matched = refs.length
    ? sources.filter((s) => refs.includes(s.item_id))
    : sources.slice(0, 2)

  if (!matched.length) {
    el.sourceRefs.innerHTML = '<p class="muted-inline">Nenhum trecho manual linkado ainda.</p>'
    return
  }

  el.sourceRefs.innerHTML = matched
    .map(
      (source) => `
      <details class="source-block">
        <summary>${escapeHtml(source.title)}</summary>
        <pre>${escapeHtml((source.content_md || '').slice(0, 1800))}</pre>
        <a href="${escapeHtml(source.source_url || '#')}" target="_blank" rel="noopener">Abrir no manual</a>
      </details>
    `,
    )
    .join('')
}

function renderDocumentRefs(pkg, candidate) {
  const docs = pkg.documents || []
  const refs = candidate.document_refs || []
  const matched = refs.length ? docs.filter((d) => refs.includes(d.doc_id)) : docs.slice(0, 4)

  if (!matched.length) {
    el.documentRefs.innerHTML = '<p class="muted-inline">Nenhum documento/link extraído neste tema.</p>'
    return
  }

  el.documentRefs.innerHTML = `
    <p class="doc-list-title">Documentos / links</p>
    <ul class="doc-list">
      ${matched
        .map(
          (doc) =>
            `<li><span class="doc-type">${escapeHtml(doc.type || 'link')}</span> <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">${escapeHtml(doc.label)}</a></li>`,
        )
        .join('')}
    </ul>
  `
}

function renderFaqPreview(title, answer, approved) {
  el.faqPreview.innerHTML = `
    <div class="faq-preview-card">
      <p class="faq-preview-theme">${escapeHtml(state.activePackage?.title || 'Tema')}</p>
      <h5>${escapeHtml(title || 'Pergunta FAQ')}</h5>
      <p>${escapeHtml(answer || 'Escreva a resposta consultando as fontes.').replace(/\n/g, '<br>')}</p>
      <button class="faq-preview-btn" type="button" disabled>Entendi</button>
    </div>
  `
  el.exportStatus.innerHTML = approved
    ? '<p class="export-ok">✓ Vai para o XLSX / FAQ Builder.</p>'
    : '<p class="export-pending">Aprove para incluir no export.</p>'
}

function renderReviewItem() {
  const pkg = state.activePackage
  if (!pkg) return
  const candidates = getCandidates(pkg)
  const item = candidates[state.activeItemIndex]
  if (!item) return

  el.reviewTitle.textContent = pkg.title
  el.reviewProgress.textContent = `Pergunta ${state.activeItemIndex + 1} de ${candidates.length}`
  el.reviewHint.textContent = 'Use fontes à esquerda para escrever a resposta — não copie o manual inteiro.'

  el.originBadge.textContent = ORIGIN_LABELS[item.origin] || item.origin || 'manual'
  if (item.ticket_count) el.originBadge.textContent += ` · ${item.ticket_count} chamados`

  el.suggestedTitleInput.value = item.suggested_title || item.question || ''
  el.suggestedAnswerInput.value = item.suggested_answer || ''
  el.reviewNotesInput.value = item.review?.notes || ''

  renderSourceRefs(pkg, item)
  renderDocumentRefs(pkg, item)

  const media = item.media_recommendation || item.ai?.latest?.media_recommendation
  const checklist = item.ai_checklist || item.ai?.latest?.checklist || []
  const lines = []
  if (!item.suggested_answer) {
    lines.push('<p><strong>Resposta vazia.</strong> Consulte fontes/documentos ou importe análise IA.</p>')
  }
  if (media?.type) lines.push(`<p><strong>Mídia:</strong> ${media.type}</p>`)
  if (checklist.length) {
    lines.push(`<p><strong>Conferir:</strong></p><ul>${checklist.map((e) => `<li>${e}</li>`).join('')}</ul>`)
  }
  el.aiInsights.innerHTML = lines.join('')

  renderFaqPreview(el.suggestedTitleInput.value, el.suggestedAnswerInput.value, item.review?.approved)
  renderItemNav()
}

async function loadRuns() {
  const payload = await api('/api/runs')
  state.runs = payload.runs || []
  renderRuns()
  if (!state.activeRunId && state.runs.length) {
    await selectRun(state.runs[0].run_id)
  }
}

async function selectRun(runId) {
  state.activeRunId = runId
  state.activePackage = null
  el.reviewPanel.classList.add('hidden')
  const payload = await api(`/api/runs/${runId}`)
  state.activeRun = payload
  renderRuns()
  renderRunPanel()
}

function openPackage(pkg) {
  state.activePackage = pkg
  state.activeItemIndex = 0
  el.reviewPanel.classList.remove('hidden')
  renderReviewItem()
}

async function saveItemReview(patch) {
  const pkg = state.activePackage
  const candidates = getCandidates(pkg)
  const item = candidates[state.activeItemIndex]
  const payload = await api(
    `/api/runs/${state.activeRunId}/packages/${pkg.package_id}/items/${candidateId(item)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggested_title: el.suggestedTitleInput.value,
        question: el.suggestedTitleInput.value,
        suggested_answer: el.suggestedAnswerInput.value,
        review: {
          ...(item.review || {}),
          notes: el.reviewNotesInput.value,
          ...patch,
        },
      }),
    },
  )
  candidates[state.activeItemIndex] = payload.item
  await selectRun(state.activeRunId)
  state.activePackage = (state.activeRun.packages || []).find((p) => p.package_id === pkg.package_id)
  renderReviewItem()
  renderPackages()
  toast(patch.approved ? 'Pergunta aprovada para FAQ' : 'Pergunta descartada')
}

async function runCrawl() {
  try {
    toast('Capturando manual, páginas e documentos...')
    const payload = await api('/api/runs/crawl', { method: 'POST' })
    await loadRuns()
    if (payload.data_dir) {
      await selectRun(payload.data_dir.split(/[\\/]/).pop())
    }
    toast('Fontes capturadas. Importe CSV de tickets para gerar perguntas reais.')
  } catch (error) {
    toast(error.message)
  }
}

async function importTickets(event) {
  if (!state.activeRunId || !event.target.files?.length) return
  const form = new FormData()
  form.append('file', event.target.files[0])
  form.append('column', 'assunto')
  try {
    toast('Importando assuntos dos tickets...')
    await fetch(`api/runs/${state.activeRunId}/import-tickets`, {
      method: 'POST',
      headers: headers(),
      body: form,
    }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Falha na importação')
      return payload
    })
    toast('Perguntas FAQ geradas a partir dos tickets')
    await selectRun(state.activeRunId)
  } catch (error) {
    toast(error.message)
  } finally {
    event.target.value = ''
  }
}

async function exportJobs() {
  if (!state.activeRunId) return
  try {
    const payload = await api(`/api/runs/${state.activeRunId}/export-ai-jobs`, { method: 'POST' })
    toast(`Jobs exportados: ${payload.jobs_root}`)
  } catch (error) {
    toast(error.message)
  }
}

async function importAnalysis(event) {
  if (!state.activeRunId || !event.target.files?.length) return
  const form = new FormData()
  for (const file of event.target.files) form.append('files', file)
  try {
    await fetch(`api/runs/${state.activeRunId}/import-ai-analysis`, {
      method: 'POST',
      headers: headers(),
      body: form,
    }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Falha')
      return payload
    })
    toast('Análises IA importadas')
    await selectRun(state.activeRunId)
  } catch (error) {
    toast(error.message)
  } finally {
    event.target.value = ''
  }
}

async function exportXlsx() {
  if (!state.activeRunId) return
  if (!totalApproved(state.activeRun?.packages || [])) {
    toast('Aprove pelo menos 1 pergunta antes de exportar')
    return
  }
  try {
    await api(`/api/runs/${state.activeRunId}/export-xlsx`, { method: 'POST' })
    toast('XLSX gerado — baixe em export/ e importe no FAQ Builder')
    await selectRun(state.activeRunId)
  } catch (error) {
    toast(error.message)
  }
}

function navigateItem(delta) {
  const total = getCandidates(state.activePackage).length
  if (!total) return
  state.activeItemIndex = Math.max(0, Math.min(total - 1, state.activeItemIndex + delta))
  renderReviewItem()
}

document.getElementById('refreshBtn').onclick = loadRuns
document.getElementById('crawlBtnEmpty').onclick = runCrawl
document.getElementById('closeReviewBtn').onclick = () => el.reviewPanel.classList.add('hidden')
document.getElementById('approveItemBtn').onclick = () => saveItemReview({ approved: true, status: 'approved' })
document.getElementById('rejectItemBtn').onclick = () => saveItemReview({ approved: false, status: 'rejected' })
document.getElementById('prevItemBtn').onclick = () => navigateItem(-1)
document.getElementById('nextItemBtn').onclick = () => navigateItem(1)

el.suggestedTitleInput.addEventListener('input', () => {
  const item = getCandidates(state.activePackage)[state.activeItemIndex]
  renderFaqPreview(el.suggestedTitleInput.value, el.suggestedAnswerInput.value, item?.review?.approved)
})
el.suggestedAnswerInput.addEventListener('input', () => {
  const item = getCandidates(state.activePackage)[state.activeItemIndex]
  renderFaqPreview(el.suggestedTitleInput.value, el.suggestedAnswerInput.value, item?.review?.approved)
})

document.getElementById('toggleGuideBtn').onclick = () => {
  const hidden = el.guideBody.classList.toggle('hidden')
  document.getElementById('toggleGuideBtn').setAttribute('aria-expanded', String(!hidden))
}

loadRuns().catch((error) => toast(error.message))
