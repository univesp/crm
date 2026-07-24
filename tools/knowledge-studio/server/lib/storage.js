const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const SERVER_ROOT = path.join(__dirname, '..')
const REPO_ROOT = path.join(SERVER_ROOT, '..', '..', '..')
const PIPELINE = path.join(REPO_ROOT, 'ops', 'knowledge-ingest', 'pipeline.py')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

function listRuns(dataDir) {
  ensureDir(dataDir)
  return fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const runPath = path.join(dataDir, entry.name)
      const manifest = readJson(path.join(runPath, 'manifest.json'), {})
      return {
        run_id: entry.name,
        manifest,
      }
    })
    .sort((a, b) => b.run_id.localeCompare(a.run_id))
}

function runPython(args, cwd) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
    const pipelinePath = process.env.PIPELINE_PATH || PIPELINE
    const child = spawn(python, [pipelinePath, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || stdout || `pipeline exit ${code}`))
    })
  })
}

function updateStep(manifestPath, stepId, patch) {
  const manifest = readJson(manifestPath, {})
  manifest.steps = manifest.steps || {}
  manifest.steps[stepId] = {
    ...(manifest.steps[stepId] || {}),
    ...patch,
    at: new Date().toISOString(),
  }
  writeJson(manifestPath, manifest)
  return manifest
}

module.exports = {
  SERVER_ROOT,
  REPO_ROOT,
  PIPELINE,
  ensureDir,
  readJson,
  writeJson,
  listRuns,
  runPython,
  updateStep,
}
