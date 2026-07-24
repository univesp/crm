const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const {
  ROOT,
  ensureDir,
  readJson,
  writeJson,
  listRuns,
  runPython,
  updateStep,
} = require('./lib/storage')

const app = express()
const PORT = Number(process.env.PORT || 8090)
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data', 'runs')
const STUDIO_PIN = process.env.STUDIO_PIN || ''

ensureDir(DATA_DIR)

app.use(express.json({ limit: '4mb' }))
app.use(express.static(path.join(ROOT, 'public')))

const upload = multer({ dest: path.join(DATA_DIR, '_uploads') })

function auth(req, res, next) {
  if (!STUDIO_PIN) return next()
  const pin = req.headers['x-studio-pin'] || req.query.pin || ''
  if (pin !== STUDIO_PIN) {
    return res.status(401).json({ error: 'PIN inválido. Configure x-studio-pin ou ?pin=' })
  }
  return next()
}

app.use('/api', auth)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, data_dir: DATA_DIR })
})

app.get('/api/runs', (_req, res) => {
  res.json({ runs: listRuns(DATA_DIR) })
})

app.post('/api/runs/crawl', async (_req, res) => {
  try {
    const result = await runPython(['crawl', '--data-dir', DATA_DIR], path.join(ROOT, '..', '..'))
    const payload = JSON.parse(result.stdout)
    res.json(payload)
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) })
  }
})

app.get('/api/runs/:runId', (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  if (!fs.existsSync(runPath)) return res.status(404).json({ error: 'Run não encontrado' })
  res.json({
    manifest: readJson(path.join(runPath, 'manifest.json')),
    packages: readJson(path.join(runPath, 'packages.json'), []),
  })
})

app.get('/api/runs/:runId/packages/:packageId', (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  const packages = readJson(path.join(runPath, 'packages.json'), [])
  const pkg = packages.find((entry) => entry.package_id === req.params.packageId)
  if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado' })
  res.json(pkg)
})

app.patch('/api/runs/:runId/steps/:stepId', (req, res) => {
  const manifestPath = path.join(DATA_DIR, req.params.runId, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: 'Run não encontrado' })
  const manifest = updateStep(manifestPath, req.params.stepId, req.body || {})
  res.json({ manifest })
})

app.patch('/api/runs/:runId/packages/:packageId/items/:itemId', (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  const packagesPath = path.join(runPath, 'packages.json')
  const packages = readJson(packagesPath, [])
  const pkgIndex = packages.findIndex((entry) => entry.package_id === req.params.packageId)
  if (pkgIndex < 0) return res.status(404).json({ error: 'Pacote não encontrado' })
  const items = packages[pkgIndex].items || []
  const itemIndex = items.findIndex((entry) => entry.item_id === req.params.itemId)
  if (itemIndex < 0) return res.status(404).json({ error: 'Item não encontrado' })
  items[itemIndex] = {
    ...items[itemIndex],
    ...(req.body || {}),
    review: {
      ...(items[itemIndex].review || {}),
      ...((req.body || {}).review || {}),
    },
  }
  packages[pkgIndex].items = items
  writeJson(packagesPath, packages)
  res.json({ item: items[itemIndex] })
})

app.post('/api/runs/:runId/export-ai-jobs', async (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  try {
    const result = await runPython(['export-ai-jobs', runPath], path.join(ROOT, '..', '..'))
    res.json(JSON.parse(result.stdout))
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) })
  }
})

app.post('/api/runs/:runId/import-ai-analysis', upload.array('files'), async (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  const jobsRoot = path.join(runPath, 'ai_jobs')
  ensureDir(jobsRoot)
  for (const file of req.files || []) {
    const raw = fs.readFileSync(file.path, 'utf8')
    let packageId = 'outros'
    try {
      const payload = JSON.parse(raw)
      packageId = payload.package_id || packageId
    } catch {
      packageId = path.basename(file.originalname).split('_')[0]
    }
    const targetDir = path.join(jobsRoot, packageId)
    ensureDir(targetDir)
    fs.renameSync(file.path, path.join(targetDir, path.basename(file.originalname)))
  }
  try {
    const result = await runPython(['import-ai-analysis', runPath], path.join(ROOT, '..', '..'))
    res.json(JSON.parse(result.stdout))
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) })
  }
})

app.get('/api/runs/:runId/ai-jobs/download', (req, res) => {
  const jobsRoot = path.join(DATA_DIR, req.params.runId, 'ai_jobs')
  if (!fs.existsSync(jobsRoot)) return res.status(404).json({ error: 'Jobs não exportados' })
  res.json({ path: jobsRoot, note: 'Baixe a pasta ai_jobs via SFTP/SCP da VM ou peça zip ao admin.' })
})

app.post('/api/runs/:runId/export-xlsx', async (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  try {
    const result = await runPython(['export-xlsx', runPath], path.join(ROOT, '..', '..'))
    res.json(JSON.parse(result.stdout))
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) })
  }
})

app.get('/api/runs/:runId/export/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.runId, 'export', req.params.filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' })
  res.download(filePath)
})

app.post('/api/runs/:runId/media', upload.single('file'), (req, res) => {
  const runPath = path.join(DATA_DIR, req.params.runId)
  const mediaDir = path.join(runPath, 'media')
  ensureDir(mediaDir)
  const assetId = req.body.asset_id || path.parse(req.file.originalname).name
  const ext = path.extname(req.file.originalname)
  const dest = path.join(mediaDir, `${assetId}${ext}`)
  fs.renameSync(req.file.path, dest)
  res.json({ ok: true, asset_id: assetId, path: dest })
})

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Knowledge Studio listening on http://0.0.0.0:${PORT}`)
  console.log(`DATA_DIR=${DATA_DIR}`)
})
