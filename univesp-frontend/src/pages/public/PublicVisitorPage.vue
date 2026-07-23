<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { createPublicTicket } from '@/services/appApi'
import { buildPublicFaqHomeEntries, buildPublicFaqRuntime } from '@/services/faqRuntime'

const router = useRouter()
const step = ref('register')
const submitting = ref(false)
const errorMessage = ref('')
const protocol = ref('')

const visitor = ref({
  nome: '',
  cpf: '',
  email: '',
  tipo: 'visitante',
})
const lgpdConsent = ref(false)
const subject = ref('')
const description = ref('')

const faqRuntime = computed(() => buildPublicFaqRuntime())
const rootEntries = computed(() => buildPublicFaqHomeEntries())
const selectedNodeId = ref('')

const faqNodeIndex = computed(() => {
  const index = new Map()
  function walk(nodes) {
    for (const node of nodes) {
      index.set(node.id, node)
      walk(node.children || [])
    }
  }
  walk(faqRuntime.value.tree)
  return index
})

const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '')
}

function canContinueRegister() {
  return (
    visitor.value.nome.trim() &&
    normalizeCpf(visitor.value.cpf).length === 11 &&
    visitor.value.email.includes('@') &&
    lgpdConsent.value
  )
}

function goToFaq() {
  if (!canContinueRegister()) {
    errorMessage.value = 'Preencha nome, CPF, e-mail e aceite o consentimento LGPD.'
    return
  }
  errorMessage.value = ''
  step.value = 'faq'
}

async function submitTicket() {
  if (!subject.value.trim() || !description.value.trim()) {
    errorMessage.value = 'Informe assunto e descricao do atendimento.'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await createPublicTicket({
      lgpd_consent: true,
      visitor: { ...visitor.value, cpf: normalizeCpf(visitor.value.cpf) },
      subject: subject.value.trim(),
      description: description.value.trim(),
      knowledge: activeNode.value
        ? { node_id: activeNode.value.id, bundle_id: faqRuntime.value.bundleId }
        : {},
    })
    protocol.value = response.data?.protocol || ''
    step.value = 'done'
  } catch (error) {
    errorMessage.value = error.message || 'Nao foi possivel abrir o protocolo.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="public-visitor">
    <header class="public-visitor__header">
      <h1>Atendimento publico UNIVESP</h1>
      <p>Candidatos, ex-alunos e visitantes.</p>
      <router-link to="/login">Ja sou aluno — entrar com SSO</router-link>
    </header>

    <p v-if="errorMessage" class="public-visitor__error">{{ errorMessage }}</p>

    <section v-if="step === 'register'" class="public-visitor__panel">
      <h2>Identificacao</h2>
      <label>
        Nome completo
        <input v-model="visitor.nome" type="text" autocomplete="name" />
      </label>
      <label>
        CPF
        <input v-model="visitor.cpf" type="text" inputmode="numeric" autocomplete="off" />
      </label>
      <label>
        E-mail
        <input v-model="visitor.email" type="email" autocomplete="email" />
      </label>
      <label>
        Tipo
        <select v-model="visitor.tipo">
          <option value="candidato">Candidato</option>
          <option value="ex_aluno">Ex-aluno</option>
          <option value="visitante">Visitante</option>
          <option value="outro">Outro</option>
        </select>
      </label>
      <label class="public-visitor__consent">
        <input v-model="lgpdConsent" type="checkbox" />
        Autorizo o uso dos dados para este atendimento, conforme a LGPD.
      </label>
      <button type="button" :disabled="!canContinueRegister()" @click="goToFaq">Continuar para FAQ</button>
    </section>

    <section v-else-if="step === 'faq'" class="public-visitor__panel">
      <h2>Como podemos ajudar?</h2>
      <ul v-if="!activeNode" class="public-visitor__faq-list">
        <li v-for="entry in rootEntries" :key="entry.id">
          <button type="button" @click="selectedNodeId = entry.id">{{ entry.title }}</button>
        </li>
      </ul>
      <div v-else>
        <p>{{ activeNode.resposta || activeNode.titulo_exibido }}</p>
        <button type="button" @click="selectedNodeId = ''">Voltar</button>
      </div>
      <hr />
      <h3>Ainda preciso de atendimento</h3>
      <label>
        Assunto
        <input v-model="subject" type="text" />
      </label>
      <label>
        Descricao
        <textarea v-model="description" rows="4" />
      </label>
      <button type="button" :disabled="submitting" @click="submitTicket">
        {{ submitting ? 'Enviando...' : 'Abrir protocolo' }}
      </button>
    </section>

    <section v-else class="public-visitor__panel">
      <h2>Protocolo registrado</h2>
      <p v-if="protocol">Numero: <strong>{{ protocol }}</strong></p>
      <p>Retornaremos pelo e-mail informado.</p>
      <button type="button" @click="router.push('/login')">Ir para login de aluno</button>
    </section>
  </main>
</template>

<style scoped>
.public-visitor {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem;
}
.public-visitor__header {
  margin-bottom: 1rem;
}
.public-visitor__panel {
  display: grid;
  gap: 0.75rem;
}
.public-visitor__panel label {
  display: grid;
  gap: 0.25rem;
}
.public-visitor__consent {
  grid-template-columns: auto 1fr;
  align-items: start;
}
.public-visitor__faq-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.public-visitor__error {
  color: #b42318;
}
</style>
