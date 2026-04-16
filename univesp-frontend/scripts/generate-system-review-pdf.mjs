import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const reviewDir = path.join(projectRoot, 'docs', 'system-review')
const assetsDir = path.join(reviewDir, 'assets', 'screens')
const outputHtmlPath = path.join(reviewDir, 'documentacao-completa-sistema-para-envio.html')

const markdownFiles = [
  '00_indice-geral.md',
  '01_visao-executiva-do-sistema.md',
  '02_visao-geral-funcional.md',
  '03_mapa-de-modulos.md',
  '04_perfis-e-permissoes.md',
  '05_fluxos-completos.md',
  '06_catalogo-de-telas.md',
  '07_regras-de-negocio-e-logica-operacional.md',
  '08_ux-e-analise-critica.md',
  '09_lacunas-riscos-e-pontos-para-validacao.md',
  '10_checklist-para-especialista.md',
  '11_resumo-final.md',
  'documentacao-completa-sistema.md',
]

function escapeHtml(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatInline(text = '') {
  let value = escapeHtml(text)

  value = value.replace(/`([^`]+)`/g, '<code>$1</code>')
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, target) => {
    const safeLabel = escapeHtml(label)
    const safeTarget = escapeHtml(target)
    return `<a href="${safeTarget}">${safeLabel}</a>`
  })

  return value
}

function markdownToHtml(markdown = '') {
  const lines = String(markdown || '').replaceAll('\r\n', '\n').split('\n')
  const chunks = []
  let paragraphBuffer = []
  let listBuffer = []
  let orderedListBuffer = []

  function flushParagraph() {
    if (!paragraphBuffer.length) {
      return
    }

    const paragraphText = paragraphBuffer.join(' ').trim()
    if (paragraphText) {
      chunks.push(`<p>${formatInline(paragraphText)}</p>`)
    }
    paragraphBuffer = []
  }

  function flushList() {
    if (!listBuffer.length) {
      return
    }
    chunks.push(`<ul>${listBuffer.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ul>`)
    listBuffer = []
  }

  function flushOrderedList() {
    if (!orderedListBuffer.length) {
      return
    }
    chunks.push(
      `<ol>${orderedListBuffer.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ol>`,
    )
    orderedListBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      flushOrderedList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      flushOrderedList()
      const level = headingMatch[1].length
      const text = formatInline(headingMatch[2])
      chunks.push(`<h${level}>${text}</h${level}>`)
      continue
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph()
      flushList()
      flushOrderedList()
      chunks.push('<hr />')
      continue
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageMatch) {
      flushParagraph()
      flushList()
      flushOrderedList()
      const alt = escapeHtml(imageMatch[1] || '')
      const src = escapeHtml(imageMatch[2] || '')
      chunks.push(
        `<figure class="inline-image"><img src="${src}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`,
      )
      continue
    }

    const listMatch = trimmed.match(/^-\s+(.+)$/)
    if (listMatch) {
      flushParagraph()
      flushOrderedList()
      listBuffer.push(listMatch[1])
      continue
    }

    const orderedListMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedListMatch) {
      flushParagraph()
      flushList()
      orderedListBuffer.push(orderedListMatch[1])
      continue
    }

    paragraphBuffer.push(trimmed)
  }

  flushParagraph()
  flushList()
  flushOrderedList()

  return chunks.join('\n')
}

function readMarkdownFile(fileName) {
  const fullPath = path.join(reviewDir, fileName)
  if (!fs.existsSync(fullPath)) {
    return {
      fileName,
      exists: false,
      markdown: '',
      html: `<div class="missing">Arquivo nao encontrado: ${escapeHtml(fileName)}</div>`,
    }
  }

  const markdown = fs.readFileSync(fullPath, 'utf8')
  return {
    fileName,
    exists: true,
    markdown,
    html: markdownToHtml(markdown),
  }
}

function collectImages(baseDir) {
  const profiles = ['geral', 'aluno', 'orientador', 'analista', 'gestor', 'admin']
  const result = []

  for (const profile of profiles) {
    const profileDir = path.join(baseDir, profile)
    if (!fs.existsSync(profileDir)) {
      continue
    }

    const files = fs
      .readdirSync(profileDir)
      .filter((file) => file.toLowerCase().endsWith('.png'))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))

    result.push({
      profile,
      files: files.map((file) => ({
        file,
        relativePath: `./assets/screens/${profile}/${file}`,
      })),
    })
  }

  return result
}

function prettyProfileName(profile = '') {
  const map = {
    geral: 'Geral',
    aluno: 'Aluno',
    orientador: 'Orientador/OP',
    analista: 'Analista de Area',
    gestor: 'Gestor de Area',
    admin: 'Admin Central',
  }
  return map[profile] || profile
}

const documents = markdownFiles.map(readMarkdownFile)
const imagesByProfile = collectImages(assetsDir)

const tocItems = documents
  .filter((doc) => doc.exists)
  .map(
    (doc, index) =>
      `<li><a href="#doc-${index + 1}">${escapeHtml(doc.fileName.replace('.md', ''))}</a></li>`,
  )
  .join('\n')

const sectionsHtml = documents
  .map((doc, index) => {
    const title = escapeHtml(doc.fileName.replace('.md', ''))
    return `
      <section class="doc-section" id="doc-${index + 1}">
        <header class="doc-header">
          <h1>${title}</h1>
          <p>Fonte: ${escapeHtml(doc.fileName)}</p>
        </header>
        <article class="doc-content">
          ${doc.html}
        </article>
      </section>
    `
  })
  .join('\n')

const galleryHtml = imagesByProfile
  .map((group) => {
    const cards = group.files
      .map(
        (item) => `
          <figure class="gallery-card">
            <img src="${item.relativePath}" alt="${escapeHtml(item.file)}" />
            <figcaption>${escapeHtml(item.file)}</figcaption>
          </figure>
        `,
      )
      .join('\n')

    return `
      <section class="gallery-group">
        <h2>${escapeHtml(prettyProfileName(group.profile))}</h2>
        <div class="gallery-grid">
          ${cards}
        </div>
      </section>
    `
  })
  .join('\n')

const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const html = `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Documentacao completa - Sistema CRM UNIVESP</title>
    <style>
      :root {
        --text: #111827;
        --muted: #4b5563;
        --border: #d1d5db;
        --bg: #ffffff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--text);
        font-family: "Segoe UI", Arial, sans-serif;
        line-height: 1.45;
        background: var(--bg);
      }
      .cover {
        padding: 28px 34px 20px;
        border-bottom: 2px solid #111827;
      }
      .cover h1 {
        margin: 0 0 10px;
        font-size: 28px;
      }
      .cover p {
        margin: 4px 0;
        color: var(--muted);
      }
      .toc {
        padding: 18px 34px;
        border-bottom: 1px solid var(--border);
      }
      .toc h2 {
        margin: 0 0 10px;
        font-size: 18px;
      }
      .toc ol {
        margin: 0;
        padding-left: 22px;
      }
      .toc li { margin: 4px 0; }
      .toc a {
        color: #1d4ed8;
        text-decoration: none;
      }
      .doc-section {
        page-break-before: always;
        padding: 26px 34px 20px;
      }
      .doc-header {
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
      }
      .doc-header h1 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .doc-header p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }
      .doc-content h1 { font-size: 24px; margin: 16px 0 8px; }
      .doc-content h2 { font-size: 20px; margin: 14px 0 8px; }
      .doc-content h3 { font-size: 16px; margin: 12px 0 6px; }
      .doc-content p { margin: 7px 0; }
      .doc-content ul, .doc-content ol {
        margin: 6px 0 8px;
        padding-left: 22px;
      }
      .doc-content li { margin: 4px 0; }
      .doc-content a { color: #1d4ed8; word-break: break-all; }
      .doc-content hr {
        border: 0;
        border-top: 1px solid var(--border);
        margin: 14px 0;
      }
      .doc-content code {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 1px 4px;
        font-family: Consolas, monospace;
        font-size: 0.92em;
      }
      .missing {
        border: 1px solid #dc2626;
        padding: 10px;
        color: #991b1b;
        background: #fef2f2;
      }
      .inline-image img {
        max-width: 100%;
        border: 1px solid var(--border);
      }
      .inline-image figcaption {
        font-size: 12px;
        color: var(--muted);
      }
      .gallery-root {
        page-break-before: always;
        padding: 26px 34px 24px;
      }
      .gallery-root h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      .gallery-group {
        page-break-inside: avoid;
        margin-top: 18px;
      }
      .gallery-group h2 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      .gallery-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 14px;
      }
      .gallery-card {
        margin: 0;
        page-break-inside: avoid;
      }
      .gallery-card img {
        width: 100%;
        border: 1px solid var(--border);
      }
      .gallery-card figcaption {
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <section class="cover">
      <h1>Documentacao completa do sistema CRM/backoffice</h1>
      <p>Projeto: UNIVESP Frontend</p>
      <p>Gerado automaticamente para envio externo com todos os documentos e imagens.</p>
      <p>Data de geracao: ${escapeHtml(generatedAt)}</p>
    </section>

    <section class="toc">
      <h2>Indice dos documentos incluidos</h2>
      <ol>
        ${tocItems}
      </ol>
    </section>

    ${sectionsHtml}

    <section class="gallery-root" id="galeria-imagens">
      <h1>Galeria de imagens embutidas</h1>
      <p>As capturas abaixo foram embutidas no PDF para permitir analise sem acesso ao sistema.</p>
      ${galleryHtml}
    </section>
  </body>
</html>
`.trim()

fs.writeFileSync(outputHtmlPath, html, 'utf8')
console.log(`HTML consolidado gerado em: ${outputHtmlPath}`)

