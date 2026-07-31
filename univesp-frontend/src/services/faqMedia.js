export const FAQ_MEDIA_TYPES = Object.freeze(['image', 'video'])
export const FAQ_MEDIA_MAX_ITEMS = 8

export function normalizeFaqMediaList(value = []) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      type: String(item.type || item.kind || '').trim().toLowerCase(),
      asset_id: String(item.asset_id || item.assetId || '').trim(),
      source_url: String(item.source_url || item.sourceUrl || item.url || '').trim(),
      thumbnail_url: String(item.thumbnail_url || item.thumbnailUrl || item.poster_url || item.posterUrl || '').trim(),
      caption: String(item.caption || '').trim(),
      alt: String(item.alt || item.alt_text || '').trim(),
      transcript: String(item.transcript || '').trim(),
    }))
}

export function resolveFaqMediaUrl(item = {}) {
  const source = String(item.source_url || item.sourceUrl || item.url || '').trim()
  if (isAllowedFaqMediaUrl(source)) return source
  const assetId = String(item.asset_id || item.assetId || '').trim()
  if (/^[a-zA-Z0-9._:-]{1,180}$/.test(assetId)) {
    return `/api/app/v1/knowledge/media/${encodeURIComponent(assetId)}`
  }
  return ''
}

export function validateFaqNodeMedia(node = {}) {
  const rawMedia = node?.media
  if (rawMedia === undefined || rawMedia === null) return []
  if (!Array.isArray(rawMedia)) {
    return [issue('invalid_media_collection', 'Midia do no deve ser uma lista.', true)]
  }
  const issues = []
  if (rawMedia.length > FAQ_MEDIA_MAX_ITEMS) {
    issues.push(issue('media_limit_exceeded', `No excede ${FAQ_MEDIA_MAX_ITEMS} itens de midia.`, true))
  }
  normalizeFaqMediaList(rawMedia).forEach((item, index) => {
    const prefix = `Midia ${index + 1}`
    if (!FAQ_MEDIA_TYPES.includes(item.type)) {
      issues.push(issue('invalid_media_type', `${prefix} deve usar image ou video.`, true))
    }
    if (!resolveFaqMediaUrl(item)) {
      issues.push(issue('invalid_media_source', `${prefix} precisa de asset_id valido ou URL HTTPS permitida.`, true))
    }
    if (item.source_url && !isAllowedFaqMediaUrl(item.source_url)) {
      issues.push(issue('unsafe_media_url', `${prefix} possui URL insegura.`, true))
    }
    if (item.thumbnail_url && !isAllowedFaqMediaUrl(item.thumbnail_url)) {
      issues.push(issue('unsafe_media_thumbnail', `${prefix} possui thumbnail insegura.`, true))
    }
    if (item.type === 'image' && !item.alt) {
      issues.push(issue('image_without_alt', `${prefix} precisa de texto alternativo.`, true))
    }
    if (item.type === 'video' && !item.caption) {
      issues.push(issue('video_without_caption', `${prefix} precisa de legenda/titulo.`, true))
    }
    if (item.type === 'video' && !item.transcript) {
      issues.push(issue('video_without_transcript', `${prefix} deveria possuir transcricao acessivel.`, false))
    }
  })
  return issues
}

function isAllowedFaqMediaUrl(value = '') {
  const source = String(value || '').trim()
  if (!source) return false
  if (source.startsWith('/api/app/v1/knowledge/media/')) return true
  try {
    const url = new URL(source)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function issue(code, message, blocking) {
  return {
    severity: blocking ? 'error' : 'warning',
    code,
    message,
    blocksImport: blocking,
    blocksPublish: blocking,
  }
}