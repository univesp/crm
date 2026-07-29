<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  createPublicTicket,
  finalizePublicTicket,
  getPublicAcademicCatalogs,
  getPublicRuntimeFlags,
  uploadPublicDocument,
} from '@/services/appApi'
import {
  buildPublicFaqHomeEntries,
  buildPublicFaqRuntime,
  getPublishedFaqLoadState,
} from '@/services/faqRuntime'
import { loadPublishedFaqType } from '@/services/publishedFaqBootstrap'

const router = useRouter()
const step = ref('faq')
const submitting = ref(false)
const errorMessage = ref('')
const protocol = ref('')
const selectedNodeId = ref('')
const selectedFile = ref(null)
const flags = ref({ faq_public_documents: false })
const academicCatalogs = ref({ courses: [], poles: [] })

const visitor = ref({
  nome: '',
  email: '',
  celular: '',
  tipo: 'visitante',
  cpf: '',
  ra: '',
  curso: '',
  polo: '',
})
const lgpdConsent = ref(false)
const subject = ref('')
const description = ref('')

const faqRuntime = computed(() => buildPublicFaqRuntime())
const faqLoadState = computed(() => getPublishedFaqLoadState('publico'))
const rootEntries = computed(() => buildPublicFaqHomeEntries())
const faqNodeIndex = computed(() => {
  const index = new Map()
  const walk = (nodes) =>
    nodes.forEach((node) => {
      index.set(node.id, node)
      walk(node.children || [])
    })
  walk(faqRuntime.value.tree)
  return index
})
const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)
const activeChildren = computed(() => activeNode.value?.children || [])
const activeBlocks = computed(() =>
  activeNode.value?.content_blocks?.length
    ? activeNode.value.content_blocks
    : [{ block_id: 'legacy-answer', type: 'text', body: activeNode.value?.resposta || activeNode.value?.pergunta_exibida || '' }],
)
const intakePolicy = computed(() => activeNode.value?.intake_policy || {})
const documentPolicy = computed(() => activeNode.value?.document_policy || { mode: 'disabled' })
const canOpenTicket = computed(() => Boolean(activeNode.value?.runtime?.isTerminal))
const documentEnabled = computed(
  () => flags.value.faq_public_documents && documentPolicy.value.mode !== 'disabled',
)

function selectNode(node) {
  selectedNodeId.value = node.id
  errorMessage.value = ''
}

function beginTicket() {
  if (!canOpenTicket.value) {
    errorMessage.value = 'Escolha uma resposta final antes de abrir o atendimento.'
    return
  }
  subject.value = activeNode.value.titulo_exibido || activeNode.value.pergunta_exibida || ''
  step.value = 'open_ticket'
  errorMessage.value = ''
}

function onFile(event) {
  selectedFile.value = event.target.files?.[0] || null
}

function validateForm() {
  const value = visitor.value
  if (!value.nome.trim() || !value.email.includes('@') || value.celular.replace(/\D/g, '').length < 10) {
    return 'Preencha nome, e-mail e celular.'
  }
  if (!description.value.trim()) return 'Descreva o que aconteceu.'
  if (!lgpdConsent.value) return 'Confirme o uso dos dados para este atendimento.'
  if (intakePolicy.value.requires_cpf && value.cpf.replace(/\D/g, '').length !== 11) {
    return 'Informe o CPF solicitado por este fluxo.'
  }
  for (const [required, field] of [
    ['requires_ra', 'ra'],
    ['requires_course', 'curso'],
    ['requires_polo', 'polo'],
  ]) {
    if (intakePolicy.value[required] && !value[field].trim()) {
      return 'Preencha os dados acadêmicos solicitados.'
    }
  }
  if (documentPolicy.value.mode === 'required' && !selectedFile.value) {
    return 'Este atendimento exige um documento.'
  }
  if (documentPolicy.value.mode !== 'disabled' && !flags.value.faq_public_documents) {
    return 'O envio de documentos está temporariamente indisponível.'
  }
  return ''
}

async function submitTicket() {
  const validationError = validateForm()
  if (validationError) {
    errorMessage.value = validationError
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await createPublicTicket({
      lgpd_consent: true,
      visitor: {
        ...visitor.value,
        cpf: visitor.value.cpf.replace(/\D/g, ''),
        celular: visitor.value.celular.replace(/\D/g, ''),
      },
      subject: subject.value.trim(),
      description: description.value.trim(),
      knowledge: {
        node_id: activeNode.value.id,
        bundle_id: activeNode.value.bundle_id || faqRuntime.value.bundleId,
        bundle_version_id:
          activeNode.value.bundle_version_id || faqRuntime.value.bundleVersionId,
        path: activeNode.value.runtime?.lineage || [],
      },
    })
    const ticket = response.data
    if (selectedFile.value) {
      await uploadPublicDocument(ticket.id, ticket.upload_token, selectedFile.value)
    }
    await finalizePublicTicket(ticket.id, ticket.upload_token)
    protocol.value = ticket.protocol || ''
    step.value = 'done'
  } catch (error) {
    errorMessage.value =
      error?.message || 'Não foi possível abrir o protocolo. Revise os dados e tente novamente.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const [, runtimeFlags, catalogs] = await Promise.all([
      loadPublishedFaqType('publico', { publicAccess: true }),
      getPublicRuntimeFlags(),
      getPublicAcademicCatalogs(),
    ])
    flags.value = runtimeFlags.data || flags.value
    academicCatalogs.value = catalogs.data || academicCatalogs.value
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível carregar as orientações agora.'
  }
})
</script>

<template>
  <main class="public-visitor">
    <header class="public-visitor__header">
      <p class="public-visitor__eyebrow">Atendimento UNIVESP</p>
      <h1>Encontre uma orientação antes de abrir atendimento</h1>
      <p>A consulta é anônima. Seus dados serão pedidos somente se você precisar abrir um protocolo.</p>
      <router-link to="/login">Entrar no portal do aluno</router-link>
    </header>

    <p v-if="errorMessage" class="public-visitor__error" role="alert">{{ errorMessage }}</p>

    <section v-if="step === 'faq'" class="public-visitor__panel">
      <div class="public-visitor__step"><strong>1</strong><span>Escolha sua dúvida</span></div>
      <p v-if="faqLoadState.status === 'loading'">Carregando orientações institucionais...</p>
      <p v-else-if="faqLoadState.status === 'error'" role="alert">{{ faqLoadState.error }}</p>
      <p v-else-if="faqLoadState.status === 'empty'">Nenhuma orientação pública está disponível.</p>
      <ul v-else-if="!activeNode" class="public-visitor__faq-list">
        <li v-for="entry in rootEntries" :key="entry.id">
          <button type="button" @click="selectNode(entry)">{{ entry.title }}</button>
        </li>
      </ul>
      <div v-else class="public-visitor__answer">
        <button type="button" class="public-visitor__back" @click="selectedNodeId = ''">Voltar aos temas</button>
        <h2>{{ activeNode.titulo_exibido }}</h2>
        <div class="public-visitor__answer-blocks">
          <template v-for="block in activeBlocks" :key="block.block_id">
            <p v-if="block.type === 'text'" class="public-visitor__answer-text">{{ block.body }}</p>
            <aside v-else-if="block.type === 'notice'" class="public-visitor__notice" role="note">{{ block.body }}</aside>
            <img v-else-if="block.type === 'image'" :src="block.url" :alt="block.alt" loading="lazy" />
            <div v-else-if="['video', 'animation'].includes(block.type)" class="public-visitor__media-block">
              <video controls playsinline :aria-label="block.alt || 'Vídeo da orientação'">
                <source :src="block.url" />
                <track v-if="block.captions_url" kind="captions" :src="block.captions_url" srclang="pt-BR" label="Português" default />
              </video>
              <details v-if="block.transcript">
                <summary>Transcrição do vídeo</summary>
                <p>{{ block.transcript }}</p>
              </details>
            </div>
            <button v-else-if="block.type === 'button' && block.action_key === 'open_ticket'" type="button" @click="beginTicket">{{ block.body || 'Abrir atendimento' }}</button>
            <button v-else-if="block.type === 'button' && block.action_key === 'go_login'" type="button" @click="router.push('/login')">{{ block.body || 'Ir para o portal do aluno' }}</button>
            <a v-else-if="['link', 'file'].includes(block.type)" :href="block.url" target="_blank" rel="noopener noreferrer" class="public-visitor__content-link">
              {{ block.body || 'Abrir conteúdo institucional' }}
            </a>
          </template>
        </div>
        <ul v-if="activeChildren.length" class="public-visitor__faq-list">
          <li v-for="child in activeChildren" :key="child.id">
            <button type="button" @click="selectNode(child)">{{ child.titulo_exibido }}</button>
          </li>
        </ul>
        <div v-if="canOpenTicket" class="public-visitor__resolved">
          <p>Esta orientação resolveu sua dúvida?</p>
          <button type="button" class="public-visitor__secondary" @click="router.push('/login')">Sim, encerrar</button>
          <button type="button" @click="beginTicket">Não, abrir atendimento</button>
        </div>
      </div>
    </section>

    <section v-else-if="step === 'open_ticket'" class="public-visitor__panel">
      <div class="public-visitor__step"><strong>2</strong><span>Abra o atendimento</span></div>
      <p>Os dados abaixo serão usados apenas para registrar e responder este protocolo.</p>
      <div class="public-visitor__grid">
        <label>Nome completo<input v-model="visitor.nome" autocomplete="name" /></label>
        <label>E-mail<input v-model="visitor.email" type="email" autocomplete="email" /></label>
        <label>Celular<input v-model="visitor.celular" type="tel" autocomplete="tel" /></label>
        <label>
          Vínculo
          <select v-model="visitor.tipo">
            <option value="aluno">Aluno com problema de acesso</option>
            <option value="candidato">Candidato</option>
            <option value="ex_aluno">Ex-aluno</option>
            <option value="visitante">Visitante</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label v-if="intakePolicy.requires_cpf">CPF<input v-model="visitor.cpf" inputmode="numeric" autocomplete="off" /></label>
        <label v-if="intakePolicy.requires_ra">RA<input v-model="visitor.ra" autocomplete="off" /></label>
        <label v-if="intakePolicy.requires_course">
          Curso
          <select v-model="visitor.curso">
            <option value="">Selecione</option>
            <option v-for="course in academicCatalogs.courses" :key="course.key" :value="course.key">{{ course.label }}</option>
          </select>
        </label>
        <label v-if="intakePolicy.requires_polo">
          Polo
          <select v-model="visitor.polo">
            <option value="">Selecione</option>
            <option v-for="pole in academicCatalogs.poles" :key="pole.key" :value="pole.key">{{ pole.label }}</option>
          </select>
        </label>
      </div>
      <label>Assunto<input v-model="subject" /></label>
      <label>O que aconteceu?<textarea v-model="description" rows="5" /></label>
      <label v-if="documentEnabled" class="public-visitor__upload">
        Documento {{ documentPolicy.mode === 'required' ? 'obrigatório' : 'opcional' }}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="onFile" />
        <small>PDF, PNG ou JPG, até 10 MiB. O arquivo passa por verificação de segurança.</small>
      </label>
      <label class="public-visitor__consent">
        <input v-model="lgpdConsent" type="checkbox" />
        Autorizo o uso destes dados para tratar este atendimento.
      </label>
      <div class="public-visitor__actions">
        <button type="button" class="public-visitor__secondary" @click="step = 'faq'">Voltar</button>
        <button type="button" :disabled="submitting" @click="submitTicket">
          {{ submitting ? 'Registrando...' : 'Abrir protocolo' }}
        </button>
      </div>
    </section>

    <section v-else class="public-visitor__panel" aria-live="polite">
      <h2>Protocolo registrado</h2>
      <p v-if="protocol">Número: <strong>{{ protocol }}</strong></p>
      <p>Guarde este número. O retorno será enviado ao e-mail informado.</p>
      <button type="button" @click="router.push('/login')">Ir para o portal do aluno</button>
    </section>
  </main>
</template>

<style scoped>
.public-visitor { max-width: 54rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); color: #172033; }
.public-visitor__header { margin-bottom: 2rem; }
.public-visitor__header h1 { max-width: 46rem; margin: .25rem 0 .75rem; font-size: clamp(1.75rem, 4vw, 2.5rem); }
.public-visitor__eyebrow { margin: 0; color: #3157a5; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.public-visitor__panel { display: grid; gap: 1rem; padding: clamp(1rem, 3vw, 2rem); border: 1px solid #d8deea; border-radius: 1rem; background: #fff; box-shadow: 0 12px 32px rgb(15 31 61 / 8%); }
.public-visitor__step { display: flex; align-items: center; gap: .75rem; }
.public-visitor__step strong { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; background: #3157a5; color: #fff; }
.public-visitor__faq-list { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
.public-visitor button { min-height: 2.75rem; padding: .7rem 1rem; border: 0; border-radius: .6rem; background: #3157a5; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.public-visitor__faq-list button { width: 100%; border: 1px solid #ccd5e5; background: #f7f9fd; color: #172033; text-align: left; }
.public-visitor__secondary, .public-visitor__back { background: #eef2f8 !important; color: #263d6b !important; }
.public-visitor__answer, .public-visitor__resolved, .public-visitor__actions { display: grid; gap: .75rem; }
.public-visitor__answer-text { padding: 1rem; border-left: .25rem solid #3157a5; background: #f7f9fd; white-space: pre-line; }
.public-visitor__answer-blocks { display: grid; gap: 1rem; }
.public-visitor__answer-blocks img, .public-visitor__answer-blocks video { width: 100%; max-height: 28rem; border-radius: .75rem; object-fit: contain; background: #101828; }
.public-visitor__notice { padding: 1rem; border-left: .25rem solid #b54708; background: #fffaeb; }
.public-visitor__content-link { display: inline-flex; width: fit-content; min-height: 2.75rem; align-items: center; padding: .65rem 1rem; border: 2px solid #3157a5; border-radius: .6rem; color: #263d6b; font-weight: 700; }
.public-visitor__resolved { margin-top: .5rem; padding-top: 1rem; border-top: 1px solid #d8deea; }
.public-visitor__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.public-visitor label { display: grid; gap: .35rem; font-weight: 650; }
.public-visitor input, .public-visitor select, .public-visitor textarea { min-height: 2.75rem; padding: .65rem .75rem; border: 1px solid #aeb9cc; border-radius: .5rem; font: inherit; }
.public-visitor__upload { padding: 1rem; border: 1px dashed #8696b2; border-radius: .75rem; }
.public-visitor__upload small { font-weight: 400; }
.public-visitor__consent { grid-template-columns: auto 1fr; align-items: start; font-weight: 400 !important; }
.public-visitor__consent input { min-height: auto; margin-top: .25rem; }
.public-visitor__actions { grid-template-columns: auto 1fr; }
.public-visitor__error { padding: .75rem 1rem; border-left: .25rem solid #b42318; background: #fff1f0; color: #8a1c13; }
@media (max-width: 40rem) { .public-visitor__grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) {
  .public-visitor *, .public-visitor *::before, .public-visitor *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
</style>
