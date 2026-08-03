<script setup>
import { computed, onMounted, reactive, ref, watchEffect } from 'vue'

import AdminBusinessCalendarDialog from '@/components/admin/AdminBusinessCalendarDialog.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildAdminParameterLevels,
  cloneAdminParametersDraft,
  findParameterLevel,
} from '@/services/adminParametersRuntime'
import { resolveDueAt } from '@/services/businessCalendar'
import { getRuntimeSettings, isMockRuntimeEnabled, updateRuntimeSettings } from '@/services/appApi'

const parameterDraft = reactive(cloneAdminParametersDraft())
const settingsVersion = ref('')
const calendarDialogOpen = ref(false)

const saveState = reactive({
  loading: false,
  error: '',
  success: '',
  reason: '',
})

const ui = reactive({
  selectedCriticalityKey: null,
  selectedSlaKey: null,
  selectedCalendarEntryId: null,
})

function ensureBusinessCalendarDraft() {
  if (!parameterDraft.businessCalendar || typeof parameterDraft.businessCalendar !== 'object') {
    parameterDraft.businessCalendar = { weeklyOff: [0, 6], entries: [] }
  }
  if (!Array.isArray(parameterDraft.businessCalendar.entries)) {
    parameterDraft.businessCalendar.entries = []
  }
}

const calendarEntries = computed(() => {
  ensureBusinessCalendarDraft()
  return parameterDraft.businessCalendar.entries
})

const selectedCalendarEntry = computed(() =>
  calendarEntries.value.find((entry) => entry.id === ui.selectedCalendarEntryId) || null,
)

const levels = computed(() => buildAdminParameterLevels(parameterDraft))

const selectedCriticalityLevel = computed(() =>
  findParameterLevel(parameterDraft.criticalityLevels, ui.selectedCriticalityKey),
)

const selectedSlaLevel = computed(() =>
  findParameterLevel(parameterDraft.slaLevels, ui.selectedSlaKey),
)

const calendarPreviewDueAt = computed(() => {
  if (!selectedSlaLevel.value) return null
  ensureBusinessCalendarDraft()
  return resolveDueAt(selectedSlaLevel.value, new Date(), parameterDraft.businessCalendar)
})

function selectCalendarEntry(entryId) {
  ui.selectedCalendarEntryId = entryId
}

function addCalendarEntry() {
  ensureBusinessCalendarDraft()
  const entry = {
    id: `calendar-${Date.now().toString(36)}`,
    date: new Date().toISOString().slice(0, 10),
    type: 'holiday',
    label: '',
  }
  parameterDraft.businessCalendar.entries.push(entry)
  ui.selectedCalendarEntryId = entry.id
}

function removeCalendarEntry(entryId) {
  ensureBusinessCalendarDraft()
  parameterDraft.businessCalendar.entries = parameterDraft.businessCalendar.entries.filter(
    (entry) => entry.id !== entryId,
  )
  if (ui.selectedCalendarEntryId === entryId) {
    ui.selectedCalendarEntryId = parameterDraft.businessCalendar.entries[0]?.id || null
  }
}

watchEffect(() => {
  ensureBusinessCalendarDraft()
  if (!selectedCriticalityLevel.value && parameterDraft.criticalityLevels[0]) {
    ui.selectedCriticalityKey = parameterDraft.criticalityLevels[0].key
  }

  if (!selectedSlaLevel.value && parameterDraft.slaLevels[0]) {
    ui.selectedSlaKey = parameterDraft.slaLevels[0].key
  }

  if (!selectedCalendarEntry.value && calendarEntries.value[0]) {
    ui.selectedCalendarEntryId = calendarEntries.value[0].id
  }
})

function selectCriticalityLevel(key) {
  ui.selectedCriticalityKey = key
}

function selectSlaLevel(key) {
  ui.selectedSlaKey = key
}

async function loadRuntimeSettings() {
  if (isMockRuntimeEnabled()) return
  saveState.loading = true
  saveState.error = ''
  try {
    const result = await getRuntimeSettings()
    settingsVersion.value = result.data?.version || ''
    const parameters = result.data?.parameters || {}
    if (
      Array.isArray(parameters.criticalityLevels)
      && Array.isArray(parameters.slaLevels)
    ) {
      Object.assign(parameterDraft, JSON.parse(JSON.stringify(parameters)))
    }
    ensureBusinessCalendarDraft()
  } catch (error) {
    saveState.error = error?.message || 'Nao foi possivel carregar os parametros institucionais.'
  } finally {
    saveState.loading = false
  }
}

async function saveRuntimeSettings() {
  saveState.error = ''
  saveState.success = ''
  if (saveState.reason.trim().length < 5) {
    saveState.error = 'Informe uma justificativa com pelo menos 5 caracteres.'
    return
  }
  saveState.loading = true
  try {
    const result = await updateRuntimeSettings({
      version: settingsVersion.value,
      reason: saveState.reason.trim(),
      parameters: JSON.parse(JSON.stringify(parameterDraft)),
    })
    settingsVersion.value = result.data?.version || ''
    saveState.reason = ''
    saveState.success = 'Parametros salvos no Frappe com versao e auditoria.'
  } catch (error) {
    saveState.error = error?.message || 'Nao foi possivel salvar os parametros institucionais.'
  } finally {
    saveState.loading = false
  }
}

onMounted(() => {
  void loadRuntimeSettings()
})
</script>

<template>
  <div class="grid gap-6">
    <section class="rounded-[8px] border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-sm font-semibold text-slate-900">Regras e prazos</h1>
          <p class="mt-1 text-xs text-slate-500">
            {{ levels.criticalityLevels.length }} níveis · {{ levels.slaLevels.length }} prazos ·
            {{ calendarEntries.length }} entradas no calendário
          </p>
        </div>
        <div class="grid w-full gap-2 lg:max-w-xl lg:grid-cols-[minmax(0,1fr)_auto]">
          <label class="grid gap-1 text-sm font-semibold text-slate-700">
            <span>Justificativa da alteração</span>
            <input
              v-model="saveState.reason"
              type="text"
              class="min-h-10 rounded-[8px] border border-slate-200 px-3 font-normal"
              placeholder="Explique o ajuste operacional"
            />
          </label>
          <button
            type="button"
            :disabled="saveState.loading"
            class="min-h-10 self-end rounded-[8px] bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            @click="saveRuntimeSettings"
          >
            {{ saveState.loading ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </div>
      </div>
      <p v-if="saveState.error" class="mt-3 text-sm font-medium text-[var(--color-danger)]" role="alert">
        {{ saveState.error }}
      </p>
      <p v-if="saveState.success" class="mt-3 text-sm font-medium text-[var(--color-success)]" role="status">
        {{ saveState.success }}
      </p>
      <p class="mt-2 text-xs text-slate-500">Alterações são versionadas e registradas para auditoria.</p>
    </section>

    <div class="crm-split-grid gap-6">
      <SectionPanel eyebrow="Criticidade" title="Níveis oficiais">
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="level in levels.criticalityLevels"
              :key="level.key"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedCriticalityKey === level.key }"
              @click="selectCriticalityLevel(level.key)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">{{ level.key }}</p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ level.label }}</p>
                  <p v-if="level.note" class="mt-2 text-sm leading-6 text-slate-600">{{ level.note }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge-base" :style="level.style">{{ level.badgeLabel }}</span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>
          </div>

          <div
            v-if="selectedCriticalityLevel"
            class="grid gap-4 rounded-[8px] border border-slate-200 bg-slate-50/75 p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="badge-base"
                :style="{
                  backgroundColor: selectedCriticalityLevel.backgroundColor,
                  color: selectedCriticalityLevel.textColor,
                }"
              >
                {{ selectedCriticalityLevel.badgeLabel }}
              </span>
              <StatusBadge :label="selectedCriticalityLevel.key" />
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Nome</span>
                <input
                  v-model="selectedCriticalityLevel.label"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Texto do badge</span>
                <input
                  v-model="selectedCriticalityLevel.badgeLabel"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor de fundo</span>
                <input
                  v-model="selectedCriticalityLevel.backgroundColor"
                  type="color"
                  class="h-12 rounded-[8px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor do texto</span>
                <input
                  v-model="selectedCriticalityLevel.textColor"
                  type="color"
                  class="h-12 rounded-[8px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2 md:col-span-2">
                <span class="text-sm font-semibold text-slate-600">Prioridade operacional</span>
                <input
                  v-model.number="selectedCriticalityLevel.operationalPriority"
                  type="number"
                  min="1"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel eyebrow="SLA" title="Janelas oficiais">
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="level in levels.slaLevels"
              :key="level.key"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedSlaKey === level.key }"
              @click="selectSlaLevel(level.key)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">{{ level.key }}</p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ level.label }}</p>
                  <p v-if="level.note" class="mt-2 text-sm leading-6 text-slate-600">{{ level.note }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge-base" :style="level.style">{{ level.badgeLabel }}</span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>
          </div>

          <div
            v-if="selectedSlaLevel"
            class="grid gap-4 rounded-[8px] border border-slate-200 bg-slate-50/75 p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="badge-base"
                :style="{
                  backgroundColor: selectedSlaLevel.backgroundColor,
                  color: selectedSlaLevel.textColor,
                }"
              >
                {{ selectedSlaLevel.badgeLabel }}
              </span>
              <SlaBadge :label="selectedSlaLevel.badgeLabel" />
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Nome</span>
                <input
                  v-model="selectedSlaLevel.label"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Texto do badge</span>
                <input
                  v-model="selectedSlaLevel.badgeLabel"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor de fundo</span>
                <input
                  v-model="selectedSlaLevel.backgroundColor"
                  type="color"
                  class="h-12 rounded-[8px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor do texto</span>
                <input
                  v-model="selectedSlaLevel.textColor"
                  type="color"
                  class="h-12 rounded-[8px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Horas</span>
                <input
                  v-model.number="selectedSlaLevel.hours"
                  type="number"
                  min="0"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Dias uteis</span>
                <input
                  v-model.number="selectedSlaLevel.businessDays"
                  type="number"
                  min="0"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Prioridade operacional</span>
                <input
                  v-model.number="selectedSlaLevel.operationalPriority"
                  type="number"
                  min="1"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>

    <section class="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-white p-4">
      <div>
        <p class="text-sm font-semibold text-slate-900">Calendário institucional</p>
        <p class="mt-1 text-xs text-slate-500">
          Feriados, pontes e recessos que não contam como dia útil nos prazos.
        </p>
      </div>
      <button type="button" class="crm-button-secondary" @click="calendarDialogOpen = true">
        Gerenciar calendário
      </button>
    </section>

    <AdminBusinessCalendarDialog
      :open="calendarDialogOpen"
      :entries="calendarEntries"
      :selected-entry="selectedCalendarEntry"
      :preview-due-at="calendarPreviewDueAt"
      @close="calendarDialogOpen = false"
      @select="selectCalendarEntry"
      @add="addCalendarEntry"
      @remove="removeCalendarEntry"
    />
  </div>
</template>
