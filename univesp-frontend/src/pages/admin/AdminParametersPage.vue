<script setup>
import { computed, onMounted, reactive, ref, watchEffect } from 'vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { buildAdminParametersRuntime, cloneAdminParametersDraft, findApplicationRule, findParameterLevel } from '@/services/adminParametersRuntime'
import { getRuntimeSettings, isMockRuntimeEnabled, updateRuntimeSettings } from '@/services/appApi'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const parameterDraft = reactive(cloneAdminParametersDraft())
const settingsVersion = ref('')
const saveState = reactive({
  loading: false,
  error: '',
  success: '',
  reason: '',
})
const ui = reactive({
  selectedCriticalityKey: null,
  selectedSlaKey: null,
  selectedRuleId: null,
  activeSection: 'official',
})

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const runtime = computed(() =>
  buildAdminParametersRuntime({
    dashboardData: dashboardData.value,
    draft: parameterDraft,
  }),
)
const selectedCriticalityLevel = computed(() =>
  findParameterLevel(parameterDraft.criticalityLevels, ui.selectedCriticalityKey),
)
const selectedSlaLevel = computed(() =>
  findParameterLevel(parameterDraft.slaLevels, ui.selectedSlaKey),
)
const selectedRule = computed(() =>
  findApplicationRule(parameterDraft.applicationRules, ui.selectedRuleId),
)
const selectedRuleImpact = computed(() => {
  if (!selectedRule.value) {
    return null
  }

  const impactedCases = runtime.value.caseImpacts.filter((item) =>
    item.matchedRules.some((rule) => rule.id === selectedRule.value.id),
  )
  const impactScope =
    selectedRule.value.targetType === 'queue'
      ? 'local'
      : impactedCases.length >= 12
        ? 'amplo'
        : 'controlado'

  return {
    impactedCases: impactedCases.length,
    highCriticalityCases: impactedCases.filter((item) => item.becomesHighCriticality).length,
    shorterSlaCases: impactedCases.filter((item) => item.getsShorterSla).length,
    impactScope,
    targetLabel:
      selectedRule.value.targetType === 'queue'
        ? selectedRule.value.targetValue
        : selectedRule.value.targetValue.replaceAll('_', ' '),
  }
})
const currentRuleTargetOptions = computed(() => {
  if (!selectedRule.value) {
    return []
  }

  if (selectedRule.value.targetType === 'theme') {
    return runtime.value.targetOptions.themes
  }

  if (selectedRule.value.targetType === 'subtheme') {
    return runtime.value.targetOptions.subthemes
  }

  return runtime.value.targetOptions.queues
})

watchEffect(() => {
  if (!selectedCriticalityLevel.value && parameterDraft.criticalityLevels[0]) {
    ui.selectedCriticalityKey = parameterDraft.criticalityLevels[0].key
  }

  if (!selectedSlaLevel.value && parameterDraft.slaLevels[0]) {
    ui.selectedSlaKey = parameterDraft.slaLevels[0].key
  }

  if (!selectedRule.value && parameterDraft.applicationRules[0]) {
    ui.selectedRuleId = parameterDraft.applicationRules[0].id
  }
})

function selectCriticalityLevel(key) {
  ui.selectedCriticalityKey = key
}

function selectSlaLevel(key) {
  ui.selectedSlaKey = key
}

function selectRule(ruleId) {
  ui.selectedRuleId = ruleId
}

async function loadRuntimeSettings() {
  if (isMockRuntimeEnabled()) return
  saveState.loading = true
  saveState.error = ''
  try {
    const result = await getRuntimeSettings()
    settingsVersion.value = result.data.version || ''
    const parameters = result.data.parameters || {}
    if (
      Array.isArray(parameters.criticalityLevels) &&
      Array.isArray(parameters.slaLevels) &&
      Array.isArray(parameters.applicationRules)
    ) {
      Object.assign(parameterDraft, JSON.parse(JSON.stringify(parameters)))
    }
  } catch (error) {
    saveState.error = error?.message || 'Nao foi possivel carregar os parametros institucionais.'
  } finally {
    saveState.loading = false
  }
}

async function saveRuntimeSettings() {
  saveState.error = ''
  saveState.success = ''
  if (isMockRuntimeEnabled()) {
    saveState.error = 'O modo mock nao persiste parametros institucionais.'
    return
  }
  if (saveState.reason.trim().length < 5) {
    saveState.error = 'Informe um motivo com pelo menos 5 caracteres.'
    return
  }
  saveState.loading = true
  try {
    const result = await updateRuntimeSettings({
      version: settingsVersion.value,
      reason: saveState.reason.trim(),
      parameters: JSON.parse(JSON.stringify(parameterDraft)),
    })
    settingsVersion.value = result.data.version || ''
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
  <div class="grid gap-4">
    <section class="rounded-[16px] border border-slate-200 bg-white p-4" aria-live="polite">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="font-semibold text-slate-950">Configuração institucional</p>
          <p class="mt-1 text-sm text-slate-600">
            {{ isMockRuntimeEnabled() ? 'Ambiente de demonstração: alterações não serão salvas.' : 'As alterações são versionadas e auditadas.' }}
          </p>
        </div>
        <div v-if="!isMockRuntimeEnabled()" class="grid gap-2 md:grid-cols-[minmax(240px,1fr)_auto]">
          <label class="grid gap-1">
            <span class="text-sm font-semibold text-slate-700">Justificativa da alteração</span>
            <input v-model="saveState.reason" type="text" class="min-h-11 rounded-[10px] border border-slate-300 px-3" placeholder="Informe por que a regra está mudando" />
          </label>
          <button type="button" :disabled="saveState.loading" class="min-h-11 self-end rounded-[10px] bg-slate-950 px-5 font-semibold text-white disabled:opacity-60" @click="saveRuntimeSettings">
            {{ saveState.loading ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </div>
      </div>
      <p v-if="saveState.error" class="mt-3 text-sm font-medium text-red-700" role="alert">{{ saveState.error }}</p>
      <p v-if="saveState.success" class="mt-3 text-sm font-medium text-green-700" role="status">{{ saveState.success }}</p>
    </section>

    <nav class="flex flex-wrap gap-2" aria-label="Seções de regras e prazos">
      <button type="button" class="min-h-11 rounded-[10px] border px-4 font-semibold" :class="ui.activeSection === 'official' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800'" @click="ui.activeSection = 'official'">Padrões oficiais</button>
      <button type="button" class="min-h-11 rounded-[10px] border px-4 font-semibold" :class="ui.activeSection === 'exceptions' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800'" @click="ui.activeSection = 'exceptions'">Exceções vigentes</button>
      <button type="button" class="min-h-11 rounded-[10px] border px-4 font-semibold" :class="ui.activeSection === 'history' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800'" @click="ui.activeSection = 'history'">Histórico</button>
    </nav>

    <div v-if="ui.activeSection === 'official'" class="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Criticidade" description="Poucos níveis oficiais usados por todas as filas.">
        <div class="grid gap-2">
          <button v-for="level in runtime.criticalityLevels" :key="level.key" type="button" class="min-h-11 rounded-[10px] border px-4 py-3 text-left" :class="ui.selectedCriticalityKey === level.key ? 'border-[var(--color-primary)] bg-red-50' : 'border-slate-200 bg-white'" @click="selectCriticalityLevel(level.key)">
            <span class="font-semibold text-slate-950">{{ level.label }}</span>
            <span class="ml-2 text-sm text-slate-600">{{ level.note }}</span>
          </button>
        </div>
        <div v-if="selectedCriticalityLevel" class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Nome</span><input v-model="selectedCriticalityLevel.label" class="min-h-11 rounded-[10px] border border-slate-300 px-3" /></label>
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Ordem de atendimento</span><input v-model.number="selectedCriticalityLevel.operationalPriority" type="number" min="1" class="min-h-11 rounded-[10px] border border-slate-300 px-3" /></label>
        </div>
      </SectionPanel>

      <SectionPanel title="Prazos de atendimento" description="Prazos oficiais que as FAQs herdam automaticamente.">
        <div class="grid gap-2">
          <button v-for="level in runtime.slaLevels" :key="level.key" type="button" class="min-h-11 rounded-[10px] border px-4 py-3 text-left" :class="ui.selectedSlaKey === level.key ? 'border-[var(--color-primary)] bg-red-50' : 'border-slate-200 bg-white'" @click="selectSlaLevel(level.key)">
            <span class="font-semibold text-slate-950">{{ level.label }}</span>
            <span class="ml-2 text-sm text-slate-600">{{ level.hours }} horas</span>
          </button>
        </div>
        <div v-if="selectedSlaLevel" class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Nome</span><input v-model="selectedSlaLevel.label" class="min-h-11 rounded-[10px] border border-slate-300 px-3" /></label>
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Prazo em horas</span><input v-model.number="selectedSlaLevel.hours" type="number" min="1" class="min-h-11 rounded-[10px] border border-slate-300 px-3" /></label>
        </div>
      </SectionPanel>
    </div>

    <SectionPanel v-else-if="ui.activeSection === 'exceptions'" title="Exceções vigentes" description="Use uma exceção somente quando o padrão institucional não atender ao fluxo.">
      <div class="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(320px,1.2fr)]">
        <div class="grid content-start gap-2">
          <button v-for="rule in runtime.rules" :key="rule.id" type="button" class="min-h-11 rounded-[10px] border px-4 py-3 text-left" :class="ui.selectedRuleId === rule.id ? 'border-[var(--color-primary)] bg-red-50' : 'border-slate-200 bg-white'" @click="selectRule(rule.id)">
            <span class="block font-semibold text-slate-950">{{ rule.targetType === 'queue' ? rule.targetValue : rule.targetValue.replaceAll('_', ' ') }}</span>
            <span class="mt-1 block text-sm text-slate-600">{{ rule.active ? 'Vigente' : 'Inativa' }} · {{ rule.note || 'Sem justificativa' }}</span>
          </button>
        </div>
        <div v-if="selectedRule" class="grid gap-3 rounded-[12px] bg-slate-50 p-4 md:grid-cols-2">
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Aplicar em</span><select v-model="selectedRule.targetType" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3"><option v-for="option in runtime.targetOptions.targetTypes" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Fluxo ou fila</span><select v-model="selectedRule.targetValue" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3"><option v-for="option in currentRuleTargetOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Criticidade</span><select v-model="selectedRule.criticalityKey" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3"><option v-for="level in runtime.criticalityLevels" :key="level.key" :value="level.key">{{ level.label }}</option></select></label>
          <label class="grid gap-1"><span class="text-sm font-semibold text-slate-700">Prazo</span><select v-model="selectedRule.slaKey" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3"><option v-for="level in runtime.slaLevels" :key="level.key" :value="level.key">{{ level.label }}</option></select></label>
          <label class="grid gap-1 md:col-span-2"><span class="text-sm font-semibold text-slate-700">Justificativa</span><textarea v-model="selectedRule.note" rows="3" class="rounded-[10px] border border-slate-300 bg-white px-3 py-2" /></label>
          <label class="flex min-h-11 items-center justify-between rounded-[10px] border border-slate-300 bg-white px-3 md:col-span-2"><span class="font-semibold text-slate-800">Exceção vigente</span><input v-model="selectedRule.active" type="checkbox" /></label>
          <p v-if="selectedRuleImpact" class="text-sm text-slate-600 md:col-span-2">Impacto estimado: {{ selectedRuleImpact.impactedCases }} atendimentos.</p>
        </div>
      </div>
    </SectionPanel>

    <SectionPanel v-else title="Histórico" description="Alterações publicadas ficam registradas com justificativa e responsável.">
      <div class="rounded-[12px] border border-slate-200 bg-slate-50 p-4">
        <p class="font-semibold text-slate-950">{{ isMockRuntimeEnabled() ? 'Sem histórico no ambiente de demonstração' : 'Versão atual: ' + (settingsVersion || 'inicial') }}</p>
        <p class="mt-1 text-sm text-slate-600">{{ isMockRuntimeEnabled() ? 'O histórico será exibido após a integração com o Frappe.' : 'Consulte a auditoria para ver responsável, justificativa e data de cada alteração.' }}</p>
      </div>
    </SectionPanel>
  </div>
</template>
