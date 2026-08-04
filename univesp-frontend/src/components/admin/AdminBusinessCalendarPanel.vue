<script setup>
import { computed, ref, watchEffect } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import {
  CALENDAR_ENTRY_TYPES,
  calendarEntryUsesRange,
  formatCalendarEntryRange,
  formatCalendarMonthLabel,
  getCalendarTypeLabel,
  groupCalendarEntriesByYearMonth,
} from '@/services/adminParametersValidation'

const props = defineProps({
  businessCalendar: { type: Object, required: true },
  selectedEntryId: { type: String, default: null },
  previewDueAt: { type: [Date, null], default: null },
  itemSaveState: { type: Object, default: () => ({}) },
  isBusy: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'add', 'remove', 'save-entry', 'save-settings'])

const selectedYear = ref(String(new Date().getFullYear()))

const entries = computed(() =>
  Array.isArray(props.businessCalendar?.entries) ? props.businessCalendar.entries : [],
)

const groupedCalendar = computed(() => groupCalendarEntriesByYearMonth(entries.value))

watchEffect(() => {
  const years = groupedCalendar.value.years
  if (!years.length) {
    selectedYear.value = String(new Date().getFullYear())
    return
  }
  if (!years.includes(selectedYear.value)) {
    selectedYear.value = years[years.length - 1]
  }
})

const monthGroups = computed(() => {
  const byMonth = groupedCalendar.value.byYearMonth[selectedYear.value] || {}
  return Object.keys(byMonth)
    .sort()
    .map((month) => ({
      month,
      label: formatCalendarMonthLabel(month),
      entries: byMonth[month],
    }))
})

const businessHoursStart = ref('09:00')
const businessHoursEnd = ref('18:00')

watchEffect(() => {
  businessHoursStart.value = props.businessCalendar?.businessHours?.start ?? '09:00'
  businessHoursEnd.value = props.businessCalendar?.businessHours?.end ?? '18:00'
})

const businessHours = computed(() => ({
  start: businessHoursStart.value,
  end: businessHoursEnd.value,
}))

function syncBusinessHoursDraft() {
  const calendar = props.businessCalendar
  if (!calendar || typeof calendar !== 'object') return
  if (!calendar.businessHours || typeof calendar.businessHours !== 'object') {
    calendar.businessHours = { start: '09:00', end: '18:00' }
  }
  calendar.businessHours.start = businessHoursStart.value
  calendar.businessHours.end = businessHoursEnd.value
}

function saveBusinessHoursSettings() {
  syncBusinessHoursDraft()
  emit('save-settings')
}

function formatPreviewDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

function itemSaveKey(entryId) {
  return `calendar:${entryId}`
}

function getItemSave(entryId) {
  return props.itemSaveState[itemSaveKey(entryId)] || { loading: false, error: '', success: '' }
}

function onTypeChange(entry) {
  if (!calendarEntryUsesRange(entry.type)) {
    entry.endDate = entry.date
  }
}

function addEntryForYear() {
  emit('add', selectedYear.value)
}
</script>

<template>
  <div class="admin-calendar-panel">
    <div class="admin-calendar-panel__settings">
      <p class="admin-calendar-panel__hint">
        Sabado e domingo nao contam por padrao.
        Horario comercial:
        <strong>{{ businessHours.start }}–{{ businessHours.end }}</strong>.
        <span v-if="previewDueAt">
          Exemplo com o primeiro prazo: {{ formatPreviewDate(previewDueAt) }}.
        </span>
      </p>
      <div class="admin-calendar-panel__hours">
        <label class="parameter-field parameter-field--compact">
          <span>Inicio do dia comercial</span>
          <input v-model="businessHoursStart" type="time" class="parameter-input" />
        </label>
        <label class="parameter-field parameter-field--compact">
          <span>Fim do dia comercial</span>
          <input v-model="businessHoursEnd" type="time" class="parameter-input" />
        </label>
        <button type="button" class="parameter-button parameter-button--primary" :disabled="isBusy" @click="saveBusinessHoursSettings">
          Salvar horario
        </button>
      </div>
    </div>

    <div class="admin-calendar-panel__years" role="tablist" aria-label="Anos do calendario">
      <button
        v-for="year in groupedCalendar.years.length ? groupedCalendar.years : [selectedYear]"
        :key="year"
        type="button"
        class="admin-calendar-panel__year-tab"
        :class="{ 'is-active': selectedYear === year }"
        role="tab"
        :aria-selected="selectedYear === year"
        @click="selectedYear = year"
      >
        {{ year }}
      </button>
    </div>

    <div v-if="!monthGroups.length" class="admin-calendar-panel__empty">
      Nenhuma entrada em {{ selectedYear }}. Adicione feriados, pontes ou recessos abaixo.
    </div>

    <section v-for="group in monthGroups" :key="group.month" class="admin-calendar-panel__month">
      <h3 class="admin-calendar-panel__month-title">{{ group.label }}</h3>
      <div class="grid gap-2">
        <article
          v-for="entry in group.entries"
          :key="entry.id"
          class="parameter-item parameter-item--compact"
          :class="{ 'is-active': selectedEntryId === entry.id }"
        >
          <button
            type="button"
            class="parameter-item__header option-button"
            :class="{ 'is-active': selectedEntryId === entry.id }"
            :aria-expanded="selectedEntryId === entry.id"
            @click="emit('select', entry.id)"
          >
            <div class="parameter-item__summary">
              <div class="min-w-0">
                <p class="parameter-item__meta">{{ getCalendarTypeLabel(entry.type) }}</p>
                <p class="parameter-item__title">{{ formatCalendarEntryRange(entry) }}</p>
                <p class="parameter-item__note">{{ entry.label || 'Sem descricao' }}</p>
              </div>
              <StatusBadge :label="getCalendarTypeLabel(entry.type)" />
            </div>
          </button>

          <div v-if="selectedEntryId === entry.id" class="parameter-item__editor">
            <div class="parameter-grid">
              <label class="parameter-field">
                <span>Tipo</span>
                <select
                  v-model="entry.type"
                  class="parameter-input"
                  @change="onTypeChange(entry)"
                >
                  <option v-for="type in CALENDAR_ENTRY_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </label>
              <label class="parameter-field">
                <span>{{ calendarEntryUsesRange(entry.type) ? 'Data inicial' : 'Data' }}</span>
                <input v-model="entry.date" type="date" class="parameter-input" />
              </label>
              <label v-if="calendarEntryUsesRange(entry.type)" class="parameter-field">
                <span>Data final</span>
                <input v-model="entry.endDate" type="date" class="parameter-input" />
              </label>
              <label class="parameter-field" :class="{ 'parameter-field--wide': !calendarEntryUsesRange(entry.type) }">
                <span>Descricao</span>
                <input v-model="entry.label" type="text" class="parameter-input" />
              </label>
            </div>

            <div class="parameter-item__actions">
              <button
                type="button"
                class="parameter-button parameter-button--danger"
                @click="emit('remove', entry.id)"
              >
                Remover
              </button>
              <div class="parameter-item__save">
                <p v-if="getItemSave(entry.id).error" class="parameter-feedback parameter-feedback--error" role="alert">
                  {{ getItemSave(entry.id).error }}
                </p>
                <p
                  v-else-if="getItemSave(entry.id).success"
                  class="parameter-feedback parameter-feedback--success"
                  role="status"
                >
                  {{ getItemSave(entry.id).success }}
                </p>
                <button
                  type="button"
                  class="parameter-button parameter-button--primary"
                  :disabled="isBusy || getItemSave(entry.id).loading"
                  @click="emit('save-entry', entry)"
                >
                  {{ getItemSave(entry.id).loading ? 'Salvando...' : 'Salvar entrada' }}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div class="admin-calendar-panel__footer">
      <button type="button" class="crm-button-secondary" @click="addEntryForYear">
        Adicionar em {{ selectedYear }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-calendar-panel {
  display: grid;
  gap: var(--space-3);
}

.admin-calendar-panel__settings {
  display: grid;
  gap: var(--space-2);
}

.admin-calendar-panel__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.45;
}

.admin-calendar-panel__hours {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.admin-calendar-panel__years {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.admin-calendar-panel__year-tab {
  min-height: 2rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.admin-calendar-panel__year-tab.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--border-default));
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 8%, white);
}

.admin-calendar-panel__empty {
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.admin-calendar-panel__month-title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
  text-transform: capitalize;
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

.parameter-item__meta {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.parameter-item__title {
  margin: 0.125rem 0 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
}

.parameter-item__note {
  margin: 0.125rem 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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

.parameter-field span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
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

.parameter-item__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.parameter-item__save {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-left: auto;
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
  cursor: wait;
}

.parameter-button--danger {
  border: 1px solid #fecaca;
  background: white;
  color: #b91c1c;
}

.parameter-feedback {
  margin: 0;
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
