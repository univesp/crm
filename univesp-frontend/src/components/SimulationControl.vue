<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  getActiveSimulation,
  searchSimulationTargets,
  startSimulation,
  stopSimulation,
} from '@/services/appApi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const dialogOpen = ref(false)
const mode = ref('generic')
const persona = ref('aluno')
const reasonCode = ref('validacao')
const search = ref('')
const queueScope = ref('')
const targets = ref([])
const selectedTargetId = ref('')
const loading = ref(false)
const systemVersion = String(import.meta.env.VITE_APP_VERSION || 'local')
const simulatorEnabled = String(import.meta.env.VITE_ENABLE_PRODUCTION_SIMULATOR || '').toLowerCase() === 'true'
const errorMessage = ref('')
const active = ref(getActiveSimulation())

const actorActions = computed(() => auth.user?.allowedActions || [])
const requiredCapability = computed(() => {
  const personaKey = persona.value === 'aluno' ? 'student' : 'op'
  const modeKey = mode.value === 'person' ? 'real' : 'generic'
  return `simulate_${personaKey}_${modeKey}`
})
const canOpen = computed(() => simulatorEnabled &&
  actorActions.value.some((action) => String(action).startsWith('simulate_')),
)
const canStart = computed(() => {
  if (!actorActions.value.includes(requiredCapability.value)) return false
  if (mode.value === 'person') return Boolean(selectedTargetId.value)
  return true
})
const expiresAt = computed(() => {
  const value = active.value?.idle_expires_at
  return value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
})

async function findTargets() {
  errorMessage.value = ''
  targets.value = []
  selectedTargetId.value = ''
  if (search.value.trim().length < 3) {
    errorMessage.value = 'Digite ao menos 3 caracteres.'
    return
  }
  loading.value = true
  try {
    const response = await searchSimulationTargets({
      search: search.value.trim(),
      persona: persona.value,
    })
    targets.value = response.data || []
    if (!targets.value.length) errorMessage.value = 'Nenhuma pessoa encontrada.'
  } catch (error) {
    errorMessage.value = error?.message || 'Nao foi possivel pesquisar agora.'
  } finally {
    loading.value = false
  }
}

async function begin() {
  if (!canStart.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const scope =
      persona.value === 'op' && queueScope.value.trim()
        ? { queues: [queueScope.value.trim()] }
        : {}
    const response = await startSimulation({
      mode: mode.value,
      persona: persona.value,
      reason_code: reasonCode.value,
      target_id: mode.value === 'person' ? selectedTargetId.value : undefined,
      scope,
    })
    active.value = response.data
    const destination = persona.value === 'aluno' ? '/aluno' : '/op/fila'
    window.location.assign(router.resolve(destination).href)
  } catch (error) {
    errorMessage.value = error?.message || 'Nao foi possivel iniciar a simulacao.'
    loading.value = false
  }
}

async function finish() {
  loading.value = true
  errorMessage.value = ''
  try {
    await stopSimulation()
    active.value = null
    window.location.assign(router.resolve('/admin/dashboard').href)
  } catch (error) {
    errorMessage.value = error?.message || 'Nao foi possivel encerrar a simulacao.'
    loading.value = false
  }
}
</script>

<template>
  <section
    v-if="active"
    class="sticky top-2 z-[170] mb-4 rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 shadow-lg"
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="font-bold text-amber-950">
          Modo de simulacao — nenhuma acao sera realizada no ambiente real
        </p>
        <p class="mt-1 text-sm text-amber-900">
          Visualizando como {{ active.persona === 'aluno' ? 'Aluno' : 'OP' }}
          · {{ active.mode === 'person' ? active.target_reference : 'perfil generico' }}
          · expira por inatividade as {{ expiresAt }}
          · versao {{ systemVersion }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-xl border border-amber-700 bg-white px-4 py-2 font-semibold text-amber-950"
        :disabled="loading"
        @click="finish"
      >
        Encerrar simulacao
      </button>
    </div>
    <p v-if="errorMessage" class="mt-2 text-sm font-semibold text-red-800">{{ errorMessage }}</p>
  </section>

  <div v-else-if="canOpen" class="mb-3 flex justify-end">
    <button
      type="button"
      class="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm"
      @click="dialogOpen = true"
    >
      Visualizar como
    </button>
  </div>

  <div
    v-if="dialogOpen && !active"
    class="fixed inset-0 z-[250] grid place-items-center bg-slate-950/50 p-4"
    role="presentation"
    @click.self="dialogOpen = false"
  >
    <section
      class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulation-title"
    >
      <h2 id="simulation-title" class="text-xl font-semibold text-slate-950">Visualizar como</h2>
      <p class="mt-2 text-sm text-slate-600">
        O seu usuario continua sendo o ator real. Toda interacao sera descartada.
      </p>

      <div class="mt-5 grid gap-4">
        <label class="grid gap-1 font-semibold text-slate-800">
          Perfil
          <select v-model="persona" class="rounded-xl border border-slate-300 px-3 py-2">
            <option value="aluno">Aluno</option>
            <option value="op">OP</option>
          </select>
        </label>
        <label class="grid gap-1 font-semibold text-slate-800">
          Tipo de visualizacao
          <select v-model="mode" class="rounded-xl border border-slate-300 px-3 py-2">
            <option value="generic">Generica</option>
            <option value="person">Pessoa real</option>
          </select>
        </label>
        <label class="grid gap-1 font-semibold text-slate-800">
          Motivo
          <select v-model="reasonCode" class="rounded-xl border border-slate-300 px-3 py-2">
            <option value="suporte">Suporte</option>
            <option value="validacao">Validacao</option>
            <option value="reclamacao">Reclamacao</option>
            <option value="auditoria">Auditoria</option>
          </select>
        </label>

        <label v-if="mode === 'generic' && persona === 'op'" class="grid gap-1 font-semibold text-slate-800">
          Fila para validar (opcional)
          <input v-model="queueScope" class="rounded-xl border border-slate-300 px-3 py-2" />
        </label>

        <div v-if="mode === 'person'" class="grid gap-2">
          <label class="font-semibold text-slate-800" for="simulation-search">
            Nome, e-mail ou RA
          </label>
          <div class="flex gap-2">
            <input
              id="simulation-search"
              v-model="search"
              class="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
              @keyup.enter="findTargets"
            />
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 font-semibold"
              :disabled="loading"
              @click="findTargets"
            >
              Pesquisar
            </button>
          </div>
          <label
            v-for="target in targets"
            :key="target.id"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"
          >
            <input v-model="selectedTargetId" type="radio" :value="target.id" />
            <span>
              <strong class="block text-slate-950">{{ target.display_name }}</strong>
              <span class="text-sm text-slate-600">{{ target.email }} · {{ target.ra || 'sem RA' }}</span>
            </span>
          </label>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-4 text-sm font-semibold text-red-700">{{ errorMessage }}</p>
      <p v-else-if="!actorActions.includes(requiredCapability)" class="mt-4 text-sm text-amber-800">
        Seu perfil nao possui permissao para esta combinacao.
      </p>

      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-300 px-4 py-2 font-semibold"
          @click="dialogOpen = false"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50"
          :disabled="loading || !canStart"
          @click="begin"
        >
          Iniciar simulacao
        </button>
      </div>
    </section>
  </div>
</template>
