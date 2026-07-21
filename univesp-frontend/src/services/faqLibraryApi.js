import {
  getKnowledgeLibrary,
  isMockRuntimeEnabled,
  updateKnowledgeLibrary,
} from '@/services/appApi'
import {
  createFaqBuilderBundleLibrary,
  loadFaqBuilderBundleLibraryLocal,
  saveFaqBuilderBundleLibraryLocal,
} from '@/services/faqBuilderHybridRuntime'

let institutionalVersion = ''

function replaceReactiveObject(target, source) {
  Object.keys(target || {}).forEach((key) => delete target[key])
  Object.assign(target, JSON.parse(JSON.stringify(source || {})))
}

export async function hydrateFaqLibrary(target, editorName = 'Admin local') {
  if (isMockRuntimeEnabled()) {
    const local = loadFaqBuilderBundleLibraryLocal(editorName)
    replaceReactiveObject(target, local)
    return { source: 'mock', version: '', initialized: true }
  }

  const response = await getKnowledgeLibrary()
  institutionalVersion = String(response.data?.version || '')
  const remote = response.data?.library
  const initialized = Boolean(
    remote &&
    remote.schemaVersion === 'faq-builder-library-v1' &&
    Array.isArray(remote.bundles),
  )
  const library = initialized ? remote : createFaqBuilderBundleLibrary(editorName)
  replaceReactiveObject(target, library)
  saveFaqBuilderBundleLibraryLocal(library, { skipNormalize: true })
  return { source: 'institutional', version: institutionalVersion, initialized }
}

export async function persistFaqLibrary(target, reason = 'Atualizacao da biblioteca FAQ') {
  saveFaqBuilderBundleLibraryLocal(target, { skipNormalize: true })
  if (isMockRuntimeEnabled()) {
    return { source: 'mock', version: '', library: target }
  }

  const response = await updateKnowledgeLibrary({
    library: JSON.parse(JSON.stringify(target || {})),
    version: institutionalVersion,
    reason,
  })
  institutionalVersion = String(response.data?.version || institutionalVersion)
  return {
    source: 'institutional',
    version: institutionalVersion,
    library: response.data?.library || target,
  }
}

export function resetFaqLibraryVersion() {
  institutionalVersion = ''
}