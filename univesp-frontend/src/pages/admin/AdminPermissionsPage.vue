<script setup>
import { computed, reactive, watch, watchEffect } from 'vue'
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import {
  applyPermissionEntryUpdate,
  buildAdminPermissionsRuntime,
  buildPermissionForm,
  cloneAdminPermissionsDraft,
  findPermissionEntry,
} from '@/services/adminPermissionsRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const permissionsDraft = reactive(cloneAdminPermissionsDraft())
const form = reactive({
  id: '',
  profileKey: '',
  scopeType: 'fila',
  scopeValues: [],
  allowedActions: {},
  note: '',
})
const ui = reactive({
  selectedEntryId: null,
  lastAuditMessage: '',
})

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const runtime = computed(() =>
  buildAdminPermissionsRuntime({
    dashboardData: dashboardData.value,
    draft: permissionsDraft,
  }),
)
const selectedEntry = computed(() => findPermissionEntry(permissionsDraft.matrix, ui.selectedEntryId))
const selectedRuntimeEntry = computed(
  () => runtime.value.matrixEntries.find((entry) => entry.id === ui.selectedEntryId) || null,
)

watchEffect(() => {
  if (!selectedEntry.value && permissionsDraft.matrix[0]) {
    ui.selectedEntryId = permissionsDraft.matrix[0].id
  }
})

watch(
  selectedEntry,
  (entry) => {
    if (!entry) {
      return
    }

    const nextForm = buildPermissionForm(entry)
    form.id = nextForm.id
    form.profileKey = nextForm.profileKey
    form.scopeType = nextForm.scopeType
    form.scopeValues = [...(nextForm.scopeValues || [])]
    form.allowedActions = { ...(nextForm.allowedActions || {}) }
    form.note = nextForm.note || ''
  },
  { immediate: true },
)

watch(
  () => form.scopeType,
  (scopeType) => {
    if (scopeType === 'global') {
      form.scopeValues = []
      return
    }

    if (scopeType === 'polo' || scopeType === 'fila' || scopeType === 'area') {
      form.scopeValues = form.scopeValues[0] ? [form.scopeValues[0]] : []
    }
  },
)

function selectEntry(entryId) {
  ui.selectedEntryId = entryId
  ui.lastAuditMessage = ''
}

function updateSingleScopeValue(value) {
  form.scopeValues = value ? [value] : []
}

function toggleScopeValue(scopeValue, checked) {
  const current = new Set(form.scopeValues)

  if (checked) {
    current.add(scopeValue)
  } else {
    current.delete(scopeValue)
  }

  form.scopeValues = [...current]
}

function savePermissionChanges() {
  const auditLog = applyPermissionEntryUpdate({
    draft: permissionsDraft,
    entryId: ui.selectedEntryId,
    nextEntry: {
      profileKey: form.profileKey,
      scopeType: form.scopeType,
      scopeValues: form.scopeValues,
      allowedActions: form.allowedActions,
      note: form.note,
    },
    actor: permissionsDraft.currentActor,
    currentDate: new Date('2026-03-25T15:20:00-03:00'),
  })

  ui.lastAuditMessage = auditLog?.summary || 'Nenhuma alteracao aplicada.'
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Admin"
      title="Permissoes e visibilidade por fila e area"
      description="Defina quem enxerga cada fila, quem administra cada area e quais acoes ficam disponiveis."
    >
      <div class="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Ator atual</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ permissionsDraft.currentActor.name }}</p>
            <p class="mt-2 text-sm text-slate-600">{{ permissionsDraft.currentActor.role }}</p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Base de impacto</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ dashboardData.activeCases.length }} casos ativos</p>
            <p class="mt-2 text-sm text-slate-600">Leitura compartilhada com dashboard e fila do OP.</p>
          </div>
        </div>

        <div class="inner-panel p-5">
          <p class="text-sm font-semibold text-slate-500">Coerencia de acesso</p>
          <p class="mt-3 text-lg font-semibold text-slate-950">Perfis, polos, filas e areas no mesmo eixo</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            A visibilidade acompanha a mesma base de casos e o mesmo roteamento por polo e fila.
          </p>
        </div>
      </div>
    </SectionPanel>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in runtime.metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <SectionPanel
      eyebrow="Impacto por perfil"
      title="Quem enxerga e quem administra"
      description="Cada perfil mostra alcance de visibilidade e alcance de governanca."
    >
      <div class="grid gap-3 xl:grid-cols-2">
        <article
          v-for="profile in runtime.profileImpacts"
          :key="profile.key"
          class="inner-panel p-5"
        >
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p class="text-xs font-semibold text-slate-500">{{ profile.key }}</p>
              <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ profile.label }}</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ profile.description }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <StatusBadge :label="`${profile.visiblePolos.length} polos`" />
              <StatusBadge :label="`${profile.visibleQueues.length} filas`" />
              <StatusBadge :label="`${profile.administeredAreas.length} areas`" />
            </div>
          </div>

          <div class="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
            <div class="rounded-[18px] bg-slate-50 px-4 py-3">
              <p class="text-sm font-semibold text-slate-500">Polos</p>
              <p class="mt-2 font-semibold text-slate-900">
                {{ profile.visiblePolos.join(', ') || 'Nao se aplica' }}
              </p>
            </div>
            <div class="rounded-[18px] bg-slate-50 px-4 py-3">
              <p class="text-sm font-semibold text-slate-500">Filas visiveis</p>
              <p class="mt-2 font-semibold text-slate-900">
                {{ profile.visibleQueues.join(', ') || 'Nenhuma' }}
              </p>
            </div>
            <div class="rounded-[18px] bg-slate-50 px-4 py-3">
              <p class="text-sm font-semibold text-slate-500">Areas administradas</p>
              <p class="mt-2 font-semibold text-slate-900">
                {{ profile.administeredAreas.join(', ') || 'Sem governanca direta' }}
              </p>
            </div>
            <div class="rounded-[18px] bg-slate-50 px-4 py-3">
              <p class="text-sm font-semibold text-slate-500">Acoes</p>
              <p class="mt-2 font-semibold text-slate-900">
                {{ profile.allowedActions.join(', ') || 'Nenhuma' }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </SectionPanel>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionPanel
        eyebrow="Matriz"
        title="Politicas por perfil e escopo"
        description="Cada entrada combina perfil, alcance e acoes permitidas."
      >
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="entry in runtime.matrixEntries"
              :key="entry.id"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedEntryId === entry.id }"
              @click="selectEntry(entry.id)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">
                    {{ entry.profileLabel }} - {{ entry.scopeLabel }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">
                    {{ entry.visibleQueueCount }} fila(s) visiveis
                  </p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    {{ entry.note }}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <StatusBadge :label="`${entry.visiblePolos.length} polos`" />
                  <StatusBadge :label="`${entry.allowedActionList.length} acoes`" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Editor"
        title="Edicao da politica selecionada"
        description="Ajuste perfil, alcance e acoes permitidas. Cada mudanca gera um registro administrativo."
      >
        <div v-if="selectedEntry && selectedRuntimeEntry" class="grid gap-5">
          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="selectedRuntimeEntry.profileLabel" />
            <StatusBadge :label="selectedRuntimeEntry.scopeLabel" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Perfil</span>
              <select
                v-model="form.profileKey"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="profile in runtime.catalogs.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Escopo</span>
              <select
                v-model="form.scopeType"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <option
                  v-for="scope in runtime.catalogs.scopeTypes"
                  :key="scope.value"
                  :value="scope.value"
                >
                  {{ scope.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div v-if="form.scopeType === 'polo'" class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Polo</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="polo in runtime.catalogs.polos"
                  :key="polo.value"
                  :value="polo.value"
                >
                  {{ polo.label }}
                </option>
              </select>
            </div>

            <div v-else-if="form.scopeType === 'multi_polo'" class="grid gap-3">
              <span class="text-sm font-semibold text-slate-600">Multiplos polos</span>
              <label
                v-for="polo in runtime.catalogs.polos"
                :key="polo.value"
                class="inner-panel flex items-center justify-between gap-3 p-4"
              >
                <span class="text-sm font-semibold text-slate-900">{{ polo.label }}</span>
                <input
                  :checked="form.scopeValues.includes(polo.value)"
                  type="checkbox"
                  @change="toggleScopeValue(polo.value, $event.target.checked)"
                />
              </label>
            </div>

            <div v-else-if="form.scopeType === 'fila'" class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Fila</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="queue in runtime.catalogs.queues"
                  :key="queue.value"
                  :value="queue.value"
                >
                  {{ queue.label }}
                </option>
              </select>
            </div>

            <div v-else-if="form.scopeType === 'multi_fila'" class="grid gap-3">
              <span class="text-sm font-semibold text-slate-600">Multiplas filas</span>
              <label
                v-for="queue in runtime.catalogs.queues"
                :key="queue.value"
                class="inner-panel flex items-center justify-between gap-3 p-4"
              >
                <span class="text-sm font-semibold text-slate-900">{{ queue.label }}</span>
                <input
                  :checked="form.scopeValues.includes(queue.value)"
                  type="checkbox"
                  @change="toggleScopeValue(queue.value, $event.target.checked)"
                />
              </label>
            </div>

            <div v-else-if="form.scopeType === 'area'" class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Area</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="area in runtime.catalogs.areas"
                  :key="area.value"
                  :value="area.value"
                >
                  {{ area.label }}
                </option>
              </select>
            </div>

            <div v-else-if="form.scopeType === 'multi_area'" class="grid gap-3">
              <span class="text-sm font-semibold text-slate-600">Multiplas areas</span>
              <label
                v-for="area in runtime.catalogs.areas"
                :key="area.value"
                class="inner-panel flex items-center justify-between gap-3 p-4"
              >
                <span class="text-sm font-semibold text-slate-900">{{ area.label }}</span>
                <input
                  :checked="form.scopeValues.includes(area.value)"
                  type="checkbox"
                  @change="toggleScopeValue(area.value, $event.target.checked)"
                />
              </label>
            </div>

            <div v-else class="inner-panel p-4">
              <p class="text-sm font-semibold text-slate-900">Escopo global</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Este escopo expande a visibilidade para todas as areas, filas e polos mapeados no sistema.
              </p>
            </div>
          </div>

          <div class="grid gap-3">
            <p class="text-sm font-semibold text-slate-600">Acoes permitidas</p>
            <label
              v-for="action in runtime.catalogs.actions"
              :key="action.value"
              class="inner-panel flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p class="text-sm font-semibold text-slate-900">{{ action.label }}</p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ action.governance ? 'Acao de governanca' : 'Acao operacional' }}
                </p>
              </div>
              <input
                v-model="form.allowedActions[action.value]"
                type="checkbox"
              />
            </label>
          </div>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-600">Observacao</span>
            <textarea
              v-model="form.note"
              rows="4"
              class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
            ></textarea>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-[18px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)]"
              @click="savePermissionChanges"
            >
              Salvar alteracao
            </button>
            <span
              v-if="ui.lastAuditMessage"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
            >
              {{ ui.lastAuditMessage }}
            </span>
          </div>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-xs font-semibold text-slate-500">Nenhuma politica selecionada</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">Selecione uma entrada da matriz.</h3>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionPanel
        eyebrow="Visibilidade"
        title="Filas visiveis por perfil"
        description="Veja quais perfis acompanham cada fila e quais assumem governanca sobre ela."
      >
        <div class="grid gap-3">
          <article
            v-for="queue in runtime.queueVisibility"
            :key="queue.queue"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-500">Fila</p>
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ queue.queue }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Perfis com acesso: {{ queue.profiles.join(', ') || 'Nenhum' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="`${queue.profiles.length} perfis`" />
                <StatusBadge :label="`${queue.governanceProfiles.length} perfis de governanca`" />
              </div>
            </div>
          </article>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Auditoria admin"
        title="Mudancas de permissao"
        description="Cada alteracao registra ator, data e comparacao entre antes e depois."
      >
        <div class="grid gap-3">
          <article
            v-for="log in runtime.auditLogs"
            :key="log.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500">
                  {{ log.targetEntryId }}
                </p>
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ log.summary }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ log.actorName }} - {{ log.actorRole }} - {{ log.changedAtLabel }}
                </p>
              </div>
              <StatusBadge :label="log.actorRole" />
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-500">Antes</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">
                  {{ log.before.scopeType }} - {{ (log.before.scopeValues || []).join(', ') || 'global' }}
                </p>
                <p class="mt-2 text-sm text-slate-600">
                  {{ Object.keys(log.before.allowedActions || {}).filter((key) => log.before.allowedActions[key]).join(', ') }}
                </p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-500">Depois</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">
                  {{ log.after.scopeType }} - {{ (log.after.scopeValues || []).join(', ') || 'global' }}
                </p>
                <p class="mt-2 text-sm text-slate-600">
                  {{ Object.keys(log.after.allowedActions || {}).filter((key) => log.after.allowedActions[key]).join(', ') }}
                </p>
              </div>
            </div>
          </article>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
