<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import AdminBusinessCalendarPanel from '@/components/admin/AdminBusinessCalendarPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildAdminParameterLevels,
  cloneAdminParametersDraft,
  findParameterLevel,
} from '@/services/adminParametersRuntime'
import {
  findDuplicatePriority,
  findDuplicateSlaDuration,
  formatSlaDurationSummary,
  getSlaDurationMode,
  getSlaDurationValue,
  setSlaDurationMode,
  setSlaDurationValue,
  validateCriticalityLevel,
  validateSlaLevel,
} from '@/services/adminParametersValidation'
import { resolveDueAt } from '@/services/businessCalendar'
import { getRuntimeSettings, isMockRuntimeEnabled, updateRuntimeSettings } from '@/services/appApi'

const parameterDraft = reactive(cloneAdminParametersDraft())
const settingsVersion = ref('')

const loadState = reactive({
  loading: false,
  error: '',
})

const itemSave = reactive({})

const ui = reactive({
  selectedCriticalityKey: null,
  selectedSlaKey: null,
  selectedCalendarEntryId: null,
})

function ensureBusinessCalendarDraft() {
  if (!parameterDraft.businessCalendar || typeof parameterDraft.businessCalendar !== 'object') {
    parameterDraft.businessCalendar = { weeklyOff: [0, 6], entries: [], businessHours: { start: '09:00', end: '18:00' } }
  }
  if (!Array.isArray(parameterDraft.businessCalendar.entries)) {
    parameterDraft.businessCalendar.entries = []
  }
  if (!parameterDraft.businessCalendar.businessHours) {
    parameterDraft.businessCalendar.businessHours = { start: '09:00', end: '18:00' }
  }
}

const calendarEntries = computed(() => {
  ensureBusinessCalendarDraft()
  return parameterDraft.businessCalendar.entries
})

const levels = computed(() => buildAdminParameterLevels(parameterDraft))

const calendarPreviewDueAt = computed(() => {
  if (!parameterDraft.slaLevels[0]) return null
  ensureBusinessCalendarDraft()
  return resolveDueAt(parameterDraft.slaLevels[0], new Date(), parameterDraft.businessCalendar)
})

const isGlobalBusy = computed(() => loadState.loading)

function itemSaveKey(section, key) {
  return `${section}:${key}`
}

function getItemSave(section, key) {
  return itemSave[itemSaveKey(section, key)] || { loading: false, error: '', success: '' }
}

function ensureItemSave(section, key) {
  const saveKey = itemSaveKey(section, key)
  if (!itemSave[saveKey]) {
    itemSave[saveKey] = { loading: false, error: '', success: '' }
  }
  return itemSave[saveKey]
}

function clearItemFeedback(section, key) {
  const state = getItemSave(section, key)
  state.error = ''
  state.success = ''
}

function priorityFeedback(section, key) {
  const levelsList =
    section === 'criticality' ? parameterDraft.criticalityLevels : parameterDraft.slaLevels
  return findDuplicatePriority(levelsList, key)
}

function slaDurationFeedback(key) {
  return findDuplicateSlaDuration(parameterDraft.slaLevels, key)
}

function selectCalendarEntry(entryId) {
  ui.selectedCalendarEntryId = ui.selectedCalendarEntryId === entryId ? null : entryId
}

function addCalendarEntry(year) {
  ensureBusinessCalendarDraft()
  const entry = {
    id: `calendar-${Date.now().toString(36)}`,
    date: `${year}-01-01`,
    endDate: `${year}-01-01`,
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
    ui.selectedCalendarEntryId = null
  }
}

function selectCriticalityLevel(key) {
  ui.selectedCriticalityKey = ui.selectedCriticalityKey === key ? null : key
}

function selectSlaLevel(key) {
  ui.selectedSlaKey = ui.selectedSlaKey === key ? null : key
}

function getCriticalityDraft(key) {
  return findParameterLevel(parameterDraft.criticalityLevels, key)
}

function getSlaDraft(key) {
  return findParameterLevel(parameterDraft.slaLevels, key)
}

function getSlaMode(key) {
  const draft = getSlaDraft(key)
  return draft ? getSlaDurationMode(draft) : 'hours'
}

function setSlaMode(key, mode) {
  const draft = getSlaDraft(key)
  if (!draft) return
  setSlaDurationMode(draft, mode)
  clearItemFeedback('sla', key)
}

function getSlaAmount(key) {
  const draft = getSlaDraft(key)
  return draft ? getSlaDurationValue(draft) : null
}

function setSlaAmount(key, value) {
  const draft = getSlaDraft(key)
  if (!draft) return
  setSlaDurationValue(draft, value)
  clearItemFeedback('sla', key)
}

async function loadRuntimeSettings() {
  if (isMockRuntimeEnabled()) return
  loadState.loading = true
  loadState.error = ''
  try {
    const result = await getRuntimeSettings()
    settingsVersion.value = result.data?.version || ''
    const parameters = result.data?.parameters || {}
    if (Array.isArray(parameters.criticalityLevels) && Array.isArray(parameters.slaLevels)) {
      Object.assign(parameterDraft, JSON.parse(JSON.stringify(parameters)))
    }
    ensureBusinessCalendarDraft()
  } catch (error) {
    loadState.error = error?.message || 'Nao foi possivel carregar os parametros institucionais.'
  } finally {
    loadState.loading = false
  }
}

async function saveItem(section, key, label) {
  const state = ensureItemSave(section, key)
  state.error = ''
  state.success = ''

  if (section === 'criticality') {
    const validationError = validateCriticalityLevel(parameterDraft.criticalityLevels, key)
    if (validationError) {
      state.error = validationError
      return
    }
  }

  if (section === 'sla') {
    const validationError = validateSlaLevel(parameterDraft.slaLevels, key)
    if (validationError) {
      state.error = validationError
      return
    }
  }

  state.loading = true
  try {
    const result = await updateRuntimeSettings({
      version: settingsVersion.value,
      reason: `Ajuste em ${label}`,
      parameters: JSON.parse(JSON.stringify(parameterDraft)),
    })
    settingsVersion.value = result.data?.version || ''
    state.success = 'Salvo.'
  } catch (error) {
    state.error = error?.message || 'Nao foi possivel salvar.'
  } finally {
    state.loading = false
  }
}

function saveCriticalityItem(level) {
  void saveItem('criticality', level.key, `Nivel oficial ${level.label}`)
}

function saveSlaItem(level) {
  void saveItem('sla', level.key, `Janela oficial ${level.label}`)
}

function saveCalendarItem(entry) {
  void saveItem('calendar', entry.id, `Calendario ${entry.label || entry.date}`)
}

function saveCalendarSettings() {
  void saveItem('calendar', 'settings', 'Horario comercial do calendario')
}

onMounted(() => {
  ensureBusinessCalendarDraft()
  void loadRuntimeSettings()
})
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white p-3">
      <p class="text-sm text-slate-600">
        Catálogos usados pelo FAQ e pela operação. Clique em um item para editar e salvar no próprio bloco.
      </p>
      <p v-if="loadState.error" class="mt-2 text-sm font-medium text-[var(--color-danger)]" role="alert">
        {{ loadState.error }}
      </p>
    </section>

    <details class="admin-parameters-section" open>
      <summary class="crm-details-summary admin-parameters-section__summary">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900">Níveis oficiais</h2>
          <p class="mt-0.5 text-sm text-slate-500">
            {{ levels.criticalityLevels.length }} níveis de criticidade
          </p>
        </div>
        <span class="crm-text-link shrink-0">Abrir</span>
      </summary>

      <div class="admin-parameters-section__body">
        <div class="grid gap-2">
          <article
            v-for="level in levels.criticalityLevels"
            :key="level.key"
            class="parameter-item parameter-item--compact"
            :class="{ 'is-active': ui.selectedCriticalityKey === level.key }"
          >
            <button
              type="button"
              class="parameter-item__header option-button"
              :class="{ 'is-active': ui.selectedCriticalityKey === level.key }"
              :aria-expanded="ui.selectedCriticalityKey === level.key"
              @click="selectCriticalityLevel(level.key)"
            >
              <div class="parameter-item__summary">
                <div class="min-w-0">
                  <p class="parameter-item__title">{{ level.label }}</p>
                  <p v-if="level.note" class="parameter-item__note">{{ level.note }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="badge-base" :style="level.style">{{ level.badgeLabel }}</span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>

            <div
              v-if="ui.selectedCriticalityKey === level.key && getCriticalityDraft(level.key)"
              class="parameter-item__editor"
            >
              <div class="parameter-grid">
                <label class="parameter-field">
                  <span>Nome</span>
                  <input v-model="getCriticalityDraft(level.key).label" class="parameter-input" />
                </label>
                <label class="parameter-field">
                  <span>Texto do badge</span>
                  <input v-model="getCriticalityDraft(level.key).badgeLabel" class="parameter-input" />
                </label>
                <label class="parameter-field">
                  <span>Cor de fundo</span>
                  <input
                    v-model="getCriticalityDraft(level.key).backgroundColor"
                    type="color"
                    class="parameter-input parameter-input--color"
                  />
                </label>
                <label class="parameter-field">
                  <span>Cor do texto</span>
                  <input
                    v-model="getCriticalityDraft(level.key).textColor"
                    type="color"
                    class="parameter-input parameter-input--color"
                  />
                </label>
                <label class="parameter-field">
                  <span>Prioridade operacional</span>
                  <input
                    v-model.number="getCriticalityDraft(level.key).operationalPriority"
                    type="number"
                    min="1"
                    class="parameter-input"
                    @input="clearItemFeedback('criticality', level.key)"
                  />
                </label>
              </div>
              <p
                v-if="priorityFeedback('criticality', level.key)"
                class="parameter-feedback parameter-feedback--error"
                role="alert"
              >
                {{ priorityFeedback('criticality', level.key) }}
              </p>
              <div class="parameter-item__actions">
                <div class="parameter-item__save">
                  <p
                    v-if="getItemSave('criticality', level.key).error"
                    class="parameter-feedback parameter-feedback--error"
                    role="alert"
                  >
                    {{ getItemSave('criticality', level.key).error }}
                  </p>
                  <p
                    v-else-if="getItemSave('criticality', level.key).success"
                    class="parameter-feedback parameter-feedback--success"
                    role="status"
                  >
                    {{ getItemSave('criticality', level.key).success }}
                  </p>
                  <button
                    type="button"
                    class="parameter-button parameter-button--primary"
                    :disabled="isGlobalBusy || getItemSave('criticality', level.key).loading || !!priorityFeedback('criticality', level.key)"
                    @click="saveCriticalityItem(level)"
                  >
                    {{ getItemSave('criticality', level.key).loading ? 'Salvando...' : 'Salvar' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </details>

    <details class="admin-parameters-section">
      <summary class="crm-details-summary admin-parameters-section__summary">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900">Janelas oficiais</h2>
          <p class="mt-0.5 text-sm text-slate-500">{{ levels.slaLevels.length }} prazos de SLA</p>
        </div>
        <span class="crm-text-link shrink-0">Abrir</span>
      </summary>

      <div class="admin-parameters-section__body">
        <div class="grid gap-2">
          <article
            v-for="level in levels.slaLevels"
            :key="level.key"
            class="parameter-item parameter-item--compact"
            :class="{ 'is-active': ui.selectedSlaKey === level.key }"
          >
            <button
              type="button"
              class="parameter-item__header option-button"
              :class="{ 'is-active': ui.selectedSlaKey === level.key }"
              :aria-expanded="ui.selectedSlaKey === level.key"
              @click="selectSlaLevel(level.key)"
            >
              <div class="parameter-item__summary">
                <div class="min-w-0">
                  <p class="parameter-item__title">{{ level.label }}</p>
                  <p v-if="level.note" class="parameter-item__note">{{ level.note }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="badge-base" :style="level.style">{{ level.badgeLabel }}</span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>

            <div
              v-if="ui.selectedSlaKey === level.key && getSlaDraft(level.key)"
              class="parameter-item__editor"
            >
              <div class="parameter-grid">
                <label class="parameter-field">
                  <span>Nome</span>
                  <input v-model="getSlaDraft(level.key).label" class="parameter-input" />
                </label>
                <label class="parameter-field">
                  <span>Texto do badge</span>
                  <input v-model="getSlaDraft(level.key).badgeLabel" class="parameter-input" />
                </label>
                <label class="parameter-field">
                  <span>Cor de fundo</span>
                  <input
                    v-model="getSlaDraft(level.key).backgroundColor"
                    type="color"
                    class="parameter-input parameter-input--color"
                  />
                </label>
                <label class="parameter-field">
                  <span>Cor do texto</span>
                  <input
                    v-model="getSlaDraft(level.key).textColor"
                    type="color"
                    class="parameter-input parameter-input--color"
                  />
                </label>
                <label class="parameter-field">
                  <span>Prioridade operacional</span>
                  <input
                    v-model.number="getSlaDraft(level.key).operationalPriority"
                    type="number"
                    min="1"
                    class="parameter-input"
                    @input="clearItemFeedback('sla', level.key)"
                  />
                </label>
                <fieldset class="parameter-field parameter-field--wide">
                  <legend class="parameter-field__legend">Unidade do prazo</legend>
                  <div class="parameter-toggle">
                    <label class="parameter-toggle__option">
                      <input
                        type="radio"
                        :name="`sla-mode-${level.key}`"
                        value="hours"
                        :checked="getSlaMode(level.key) === 'hours'"
                        @change="setSlaMode(level.key, 'hours')"
                      />
                      Horas corridas
                    </label>
                    <label class="parameter-toggle__option">
                      <input
                        type="radio"
                        :name="`sla-mode-${level.key}`"
                        value="businessDays"
                        :checked="getSlaMode(level.key) === 'businessDays'"
                        @change="setSlaMode(level.key, 'businessDays')"
                      />
                      Dias uteis
                    </label>
                  </div>
                </fieldset>
                <label class="parameter-field">
                  <span>{{ getSlaMode(level.key) === 'businessDays' ? 'Quantidade de dias uteis' : 'Quantidade de horas' }}</span>
                  <input
                    :value="getSlaAmount(level.key)"
                    type="number"
                    min="1"
                    class="parameter-input"
                    @input="setSlaAmount(level.key, $event.target.value)"
                  />
                </label>
              </div>
              <p class="parameter-hint">{{ formatSlaDurationSummary(getSlaDraft(level.key)) }}</p>
              <p
                v-if="priorityFeedback('sla', level.key)"
                class="parameter-feedback parameter-feedback--error"
                role="alert"
              >
                {{ priorityFeedback('sla', level.key) }}
              </p>
              <p
                v-else-if="slaDurationFeedback(level.key)"
                class="parameter-feedback parameter-feedback--error"
                role="alert"
              >
                {{ slaDurationFeedback(level.key) }}
              </p>
              <div class="parameter-item__actions">
                <div class="parameter-item__save">
                  <p
                    v-if="getItemSave('sla', level.key).error"
                    class="parameter-feedback parameter-feedback--error"
                    role="alert"
                  >
                    {{ getItemSave('sla', level.key).error }}
                  </p>
                  <p
                    v-else-if="getItemSave('sla', level.key).success"
                    class="parameter-feedback parameter-feedback--success"
                    role="status"
                  >
                    {{ getItemSave('sla', level.key).success }}
                  </p>
                  <button
                    type="button"
                    class="parameter-button parameter-button--primary"
                    :disabled="
                        isGlobalBusy ||
                        getItemSave('sla', level.key).loading ||
                        !!priorityFeedback('sla', level.key) ||
                        !!slaDurationFeedback(level.key)
                      "
                    @click="saveSlaItem(level)"
                  >
                    {{ getItemSave('sla', level.key).loading ? 'Salvando...' : 'Salvar' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </details>

    <details class="admin-parameters-section">
      <summary class="crm-details-summary admin-parameters-section__summary">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900">Calendário institucional</h2>
          <p class="mt-0.5 text-sm text-slate-500">
            {{ calendarEntries.length }} entradas · feriados, pontes e recessos
          </p>
        </div>
        <span class="crm-text-link shrink-0">Abrir</span>
      </summary>

      <div class="admin-parameters-section__body">
        <AdminBusinessCalendarPanel
          :business-calendar="parameterDraft.businessCalendar"
          :selected-entry-id="ui.selectedCalendarEntryId"
          :preview-due-at="calendarPreviewDueAt"
          :item-save-state="itemSave"
          :is-busy="isGlobalBusy"
          @select="selectCalendarEntry"
          @add="addCalendarEntry"
          @remove="removeCalendarEntry"
          @save-entry="saveCalendarItem"
          @save-settings="saveCalendarSettings"
        />
      </div>
    </details>
  </div>
</template>

<style scoped>
.admin-parameters-section {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  padding: var(--space-3);
}

.admin-parameters-section__summary {
  padding-bottom: var(--space-1);
}

.admin-parameters-section__body {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
  margin-top: var(--space-2);
}

.parameter-item {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.parameter-item.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--border-default));
}

.parameter-item__header {
  width: 100%;
  border: none;
  border-radius: 0;
}

.parameter-item__header.option-button.is-active {
  border-bottom: 1px solid var(--border-default);
}

.parameter-item__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.parameter-item__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
}

.parameter-item__note {
  margin: 0.125rem 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.parameter-item__editor {
  padding: var(--space-3);
  background: color-mix(in srgb, var(--surface-muted, #f8fafc) 80%, white);
}

.parameter-grid {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.parameter-field {
  display: grid;
  gap: 0.25rem;
}

.parameter-field--wide {
  grid-column: 1 / -1;
}

.parameter-field span,
.parameter-field__legend {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.parameter-field__legend {
  margin-bottom: 0.25rem;
}

.parameter-input {
  min-height: 2.25rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: white;
  padding: 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.parameter-input--color {
  padding: 0.125rem;
}

.parameter-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.parameter-toggle__option {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.25rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: white;
  padding: 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.parameter-hint {
  margin: var(--space-2) 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.parameter-item__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

.parameter-item__save {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.parameter-button {
  min-height: 2.25rem;
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.parameter-button--primary {
  border: none;
  background: var(--color-text, #0f172a);
  color: white;
}

.parameter-button--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.parameter-feedback {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.parameter-feedback--error {
  color: var(--color-danger);
}

.parameter-feedback--success {
  color: var(--color-success);
}
</style>
