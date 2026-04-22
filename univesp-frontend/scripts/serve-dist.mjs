import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv = []) {
  const args = {
    root: path.resolve(process.cwd(), 'dist'),
    port: 8080,
    base: '/crm/',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]

    if (current === '--root' && next) {
      args.root = path.resolve(next)
      index += 1
      continue
    }

    if (current === '--port' && next) {
      args.port = Number(next)
      index += 1
      continue
    }

    if (current === '--base' && next) {
      args.base = next
      index += 1
    }
  }

  if (!args.base.startsWith('/')) {
    args.base = `/${args.base}`
  }

  if (!args.base.endsWith('/')) {
    args.base = `${args.base}/`
  }

  return args
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const noCacheHeaders = Object.freeze({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
})

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function writeText(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...noCacheHeaders,
  })
  response.end(body)
}

const { root, port, base } = parseArgs(process.argv.slice(2))
const distIndex = path.join(root, 'index.html')

if (!existsSync(distIndex)) {
  console.error(`[univesp-frontend] dist nao encontrado em ${root}`)
  process.exit(1)
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `localhost:${port}`}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname === '/') {
    response.writeHead(302, { Location: base })
    response.end()
    return
  }

  if (!pathname.startsWith(base)) {
    writeText(response, 404, 'Rota fora do escopo do preview local.')
    return
  }

  const relativePath = pathname.slice(base.length) || 'index.html'
  const candidatePath = path.resolve(root, relativePath)

  if (!candidatePath.startsWith(root)) {
    writeText(response, 403, 'Acesso negado.')
    return
  }

  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
    response.writeHead(200, {
      'Content-Type': getContentType(candidatePath),
      ...noCacheHeaders,
    })
    createReadStream(candidatePath).pipe(response)
    return
  }

  const hasExtension = Boolean(path.extname(candidatePath))
  if (!hasExtension) {
    const html = await readFile(distIndex)
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      ...noCacheHeaders,
    })
    response.end(html)
    return
  }

  writeText(response, 404, 'Arquivo nao encontrado no preview local.')
})

server.listen(port, '0.0.0.0', () => {
  console.log(`[univesp-frontend] Servindo dist estatico em http://localhost:${port}${base}`)
  console.log('[univesp-frontend] Pressione Ctrl + C para encerrar.')
})
