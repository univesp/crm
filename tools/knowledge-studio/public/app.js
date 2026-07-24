const state = {
  runs: [],
  activeRunId: null,
  activeRun: null,
  activePackage: null,
  activeItemIndex: 0,
}

const STEPS = [
  { id: 'crawl', label: 'Crawler' },
  { id: 'structure_review', label: 'Validar estrutura' },
  { id: 'ai_analysis', label: 'Análise IA externa' },
  { id: 'consolidate', label: 'Consolidar' },
  { id: 'studio_review', label: 'Curadoria Studio' },
  { id: 'export_faq', label: 'Export FAQ' },
]

const el = {
  runsList: document.getElementById('runsList'),
  stepsList: document.getElementById('stepsList'),
  emptyState: document.getElementById('emptyState'),
  runPanel: document.getElementById('runPanel'),
  runTitle: document.getElementById('runTitle'),
  runMeta: document.getElementById('runMeta'),
  packagesGrid: document.getElementById('packagesGrid'),
  reviewPanel: document.getElementById('reviewPanel'),
  reviewTitle: document.getElementById('reviewTitle'),
  reviewProgress: document.getElementById('reviewProgress'),
  originalContent: document.getElementById('originalContent'),
  suggestedTitleInput: document.getElementById('suggestedTitleInput'),
  suggestedAnswerInput: document.getElementById('suggestedAnswerInput'),
  aiInsights: document.getElementById('aiInsights'),
  reviewNotesInput: document.getElementById('reviewNotesInput'),
  toast: document.getElementById('toast'),
  pinInput: document.getElementById('pinInput'),
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
  setTimeout(() => el.toast.classList.add('hidden'), 3200)
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

function renderSteps(manifest) {
  el.stepsList.innerHTML = ''
  for (const step of STEPS) {
    const li = document.createElement('li')
    li.className = 'step-item'
    const status = manifest?.steps?.[step.id]?.status || 'pending'
    li.textContent = `${step.label} — ${status}`
    el.stepsList.appendChild(li)
  }
}

function packageProgress(pkg) {
  const items = pkg.items || []
  const approved = items.filter((item) => item.review?.approved).length
  return { approved, total: items.length }
}

function renderRuns() {
  el.runsList.innerHTML = ''
  for (const run of state.runs) {
    const card = document.createElement('div')
    card.className = `run-card${run.run_id === state.activeRunId ? ' active' : ''}`
    card.innerHTML = `<strong>${run.run_id}</strong><br/><span>${run.manifest?.chunk_count || 0} chunks</span>`
    card.onclick = () => selectRun(run.run_id)
    el.runsList.appendChild(card)
  }
}

function renderPackages() {
  const packages = (state.activeRun?.packages || []).filter((pkg) => pkg.chunk_count > 0)
  el.packagesGrid.innerHTML = ''
  for (const pkg of packages) {
    const { approved, total } = packageProgress(pkg)
    const pct = total ? Math.round((approved / total) * 100) : 0
    const card = document.createElement('article')
    card.className = 'package-card'
    card.innerHTML = `
      <h3>${pkg.title}</h3>
      <p>${pkg.description || ''}</p>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <p>${approved}/${total} aprovados</p>
      <button class="btn primary">Curadoria</button>
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
  el.runTitle.textContent = `Execução ${state.activeRunId}`
  el.runMeta.textContent = `${manifest.chunk_count || 0} chunks · ${manifest.package_count || 0} pacotes · ${manifest.crawled_at || ''}`
  renderSteps(manifest)
  renderPackages()
}

async function loadRuns() {
  const payload = await api('/api/runs')
  state.runs = payload.runs || []
  renderRuns()
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

function renderReviewItem() {
  const pkg = state.activePackage
  if (!pkg) return
  const items = pkg.items || []
  const item = items[state.activeItemIndex]
  if (!item) return
  el.reviewTitle.textContent = `${pkg.title} — ${item.title}`
  el.reviewProgress.textContent = `Item ${state.activeItemIndex + 1} de ${items.length}`
  el.originalContent.textContent = item.content_md || ''
  el.suggestedTitleInput.value = item.suggested_title || item.title || ''
  el.suggestedAnswerInput.value = item.suggested_answer || ''
  el.reviewNotesInput.value = item.review?.notes || ''

  const media = item.media_recommendation || item.ai?.latest?.media_recommendation
  const checklist = item.ai_checklist || item.ai?.latest?.checklist || []
  const lines = []
  if (media?.type) lines.push(`<p><strong>Mídia:</strong> ${media.type} — ${media.reason || ''}</p>`)
  if (media?.recording_script?.length) {
    lines.push(`<p><strong>Roteiro:</strong></p><ul>${media.recording_script.map((step) => `<li>${step}</li>`).join('')}</ul>`)
  }
  if (checklist.length) {
    lines.push(`<p><strong>Conferir:</strong></p><ul>${checklist.map((entry) => `<li>${entry}</li>`).join('')}</ul>`)
  }
  el.aiInsights.innerHTML = lines.join('') || '<p>Sem análise IA importada ainda.</p>'
}

async function saveItemReview(patch) {
  const pkg = state.activePackage
  const item = pkg.items[state.activeItemIndex]
  const payload = await api(
    `/api/runs/${state.activeRunId}/packages/${pkg.package_id}/items/${item.item_id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggested_title: el.suggestedTitleInput.value,
        suggested_answer: el.suggestedAnswerInput.value,
        review: {
          ...(item.review || {}),
          notes: el.reviewNotesInput.value,
          ...patch,
        },
      }),
    },
  )
  pkg.items[state.activeItemIndex] = payload.item
  await selectRun(state.activeRunId)
  state.activePackage = (state.activeRun.packages || []).find((entry) => entry.package_id === pkg.package_id)
  renderReviewItem()
  renderPackages()
}

document.getElementById('refreshBtn').onclick = loadRuns

document.getElementById('crawlBtn').onclick = async () => {
  try {
    toast('Rodando crawler...')
    const payload = await api('/api/runs/crawl', { method: 'POST' })
    await loadRuns()
    if (payload.data_dir) {
      const runId = payload.data_dir.split(/[\\/]/).pop()
      await selectRun(runId)
    }
    toast('Crawler concluído')
  } catch (error) {
    toast(error.message)
  }
}

document.getElementById('approveStructureBtn').onclick = async () => {
  if (!state.activeRunId) return
  await api(`/api/runs/${state.activeRunId}/steps/structure_review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  })
  toast('Estrutura validada')
  await selectRun(state.activeRunId)
}

document.getElementById('exportJobsBtn').onclick = async () => {
  if (!state.activeRunId) return
  try {
    const payload = await api(`/api/runs/${state.activeRunId}/export-ai-jobs`, { method: 'POST' })
    toast(`Jobs exportados em ${payload.jobs_root}`)
  } catch (error) {
    toast(error.message)
  }
}

document.getElementById('importAnalysisInput').onchange = async (event) => {
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
      if (!response.ok) throw new Error(payload.error || 'Falha na importação')
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

document.getElementById('exportXlsxBtn').onclick = async () => {
  if (!state.activeRunId) return
  try {
    await api(`/api/runs/${state.activeRunId}/export-xlsx`, { method: 'POST' })
    toast('XLSX gerado — baixe via SFTP em export/ ou peça ao admin')
  } catch (error) {
    toast(error.message)
  }
}

document.getElementById('closeReviewBtn').onclick = () => {
  el.reviewPanel.classList.add('hidden')
}

document.getElementById('approveItemBtn').onclick = () => saveItemReview({ approved: true, status: 'approved' })
document.getElementById('rejectItemBtn').onclick = () => saveItemReview({ approved: false, status: 'rejected' })

loadRuns().catch((error) => toast(error.message))
