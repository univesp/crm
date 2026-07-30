<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { buildStudentFaqRuntime } from '@/services/faqRuntime'
import { buildStudentPortalSearch } from '@/services/studentPortalRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const searchQuery = ref('')
const showSearch = ref(false)

const userName = computed(() => auth.mockContext.userName.split(' ')[0] || 'Aluno')
const faqRuntime = computed(() => buildStudentFaqRuntime())
const searchResults = computed(() =>
  buildStudentPortalSearch({
    faqTree: faqRuntime.value.tree,
    protocolDraft: studentSupportStore.protocolDraft,
    records: studentSupportStore.records,
    protocols: studentSupportStore.protocols,
    query: searchQuery.value,
  }),
)

function startJourney() {
  studentSupportStore.resetFaqExperience()
  router.push('/aluno/duvida')
}

function openSearchResult(route) {
  if (!route) {
    return
  }

  router.push(route)
}

function toggleSearch() {
  showSearch.value = !showSearch.value
}
</script>

<template>
  <StudentStageLayout
    eyebrow="Central de atendimento"
    :title="`Olá, ${userName}!`"
    description="Como podemos ajudar hoje?"
  >
    <div class="grid max-w-[720px] gap-3 xl:min-h-[360px] xl:content-center">
      <button
        type="button"
        class="student-focus-ring rounded-[8px] border border-[rgba(209,50,57,0.24)] bg-[rgba(209,50,57,0.08)] px-5 py-5 text-left"
        @click="startJourney"
      >
        <div class="flex items-start gap-4">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-semibold text-[var(--color-primary-dark)]">
            1
          </span>
          <div>
            <p class="text-xl font-semibold text-slate-950">Tenho uma dúvida</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Consulte a orientação oficial e siga para solicitação se precisar.
            </p>
          </div>
        </div>
      </button>

      <RouterLink
        to="/aluno/solicitacoes"
        class="student-focus-ring rounded-[8px] border border-slate-200 bg-white px-5 py-5 text-left hover:bg-slate-50"
      >
        <div class="flex items-start gap-4">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(209,50,57,0.08)] text-base font-semibold text-[var(--color-primary-dark)]">
            2
          </span>
          <div>
            <p class="text-lg font-semibold text-slate-950">Minhas solicitações</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Acompanhe protocolos e respostas em andamento.
            </p>
          </div>
        </div>
      </RouterLink>

      <div class="rounded-[8px] border border-slate-200 bg-white p-4">
        <button
          type="button"
          class="student-focus-ring flex w-full items-center justify-between gap-3 text-left"
          :aria-expanded="showSearch || searchQuery.trim().length ? 'true' : 'false'"
          aria-controls="student-home-search-panel"
          :aria-label="showSearch || searchQuery.trim().length ? 'Recolher busca rápida' : 'Expandir busca rápida'"
          @click="toggleSearch"
        >
          <div>
            <p class="text-sm font-semibold text-slate-900">Já sabe o assunto ou protocolo?</p>
            <p class="mt-1 text-sm leading-6 text-slate-600">
              Use a busca como atalho rápido.
            </p>
          </div>
          <span aria-hidden="true" class="text-sm font-semibold text-slate-500">
            {{ showSearch || searchQuery.trim().length ? '-' : '+' }}
          </span>
        </button>

        <div
          v-if="showSearch || searchQuery.trim().length"
          id="student-home-search-panel"
          class="mt-4 grid gap-3 border-t border-slate-200 pt-4"
        >
          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-900">Buscar assunto ou protocolo</span>
            <input
              v-model="searchQuery"
              type="search"
              class="student-focus-ring rounded-[8px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 focus:bg-white"
              placeholder="Ex.: rematrícula ou UVSP-20260326-173141"
              aria-describedby="student-search-help"
            />
          </label>
          <p id="student-search-help" class="text-sm leading-6 text-slate-600">
            A busca encontra assuntos do portal e registros já existentes.
          </p>

          <div
            v-if="searchQuery.trim().length"
            class="grid gap-3"
            role="status"
            aria-live="polite"
          >
            <div v-if="searchResults.faqMatches.length" class="grid gap-2">
              <p class="student-section-label">
                Assuntos do portal
              </p>
              <button
                v-for="item in searchResults.faqMatches"
                :key="item.id"
                type="button"
                class="student-focus-ring rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-50"
                @click="openSearchResult(item.route)"
              >
                <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-600">
                  {{ item.lineage.join(' > ') }}
                </p>
              </button>
            </div>

            <div v-if="searchResults.requestMatches.length" class="grid gap-2">
              <p class="student-section-label">
                Meus registros
              </p>
              <button
                v-for="item in searchResults.requestMatches"
                :key="item.id"
                type="button"
                class="student-focus-ring rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-50"
                @click="openSearchResult(item.route)"
              >
                <p class="text-sm font-semibold text-slate-900">{{ item.subject }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-600">
                  {{ item.id }}
                </p>
              </button>
            </div>

            <p
              v-if="!searchResults.faqMatches.length && !searchResults.requestMatches.length"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600"
            >
              Nenhum resultado encontrado para esta busca.
            </p>
          </div>
        </div>
      </div>
    </div>
  </StudentStageLayout>
</template>
