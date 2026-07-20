<script setup>
import { computed, onMounted, reactive, ref, watchEffect } from 'vue'
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
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
})

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const runtime = computed(() =>
  buildAdminParametersRuntime({
    dashboardData: dashboardData.value,
    draft: parameterDraft,
  }),
)
const metrics = computed(() => runtime.value.metrics)
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
  <div class="grid gap-6">
    <section class="rounded-[16px] border border-slate-200 bg-white px-5 py-4" aria-live="polite">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-950">Persistencia institucional</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            {{ isMockRuntimeEnabled() ? 'Modo mock: alteracoes ficam somente nesta sessao.' : `Versao carregada: ${settingsVersion || 'inicial'}.` }}
          </p>
        </div>
        <div class="grid w-full gap-2 lg:max-w-xl lg:grid-cols-[minmax(0,1fr)_auto]">
          <label class="grid gap-1 text-sm font-semibold text-slate-700">
            <span>Motivo da alteracao</span>
            <input v-model="saveState.reason" type="text" class="min-h-10 rounded-[12px] border border-slate-200 px-3 font-normal" placeholder="Explique o ajuste operacional" />
          </label>
          <button type="button" :disabled="saveState.loading" class="min-h-10 rounded-[12px] bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" @click="saveRuntimeSettings">
            {{ saveState.loading ? 'Salvando...' : 'Salvar parametros' }}
          </button>
        </div>
      </div>
      <p v-if="saveState.error" class="mt-3 text-sm font-medium text-[var(--color-danger)]" role="alert">{{ saveState.error }}</p>
      <p v-if="saveState.success" class="mt-3 text-sm font-medium text-[var(--color-success)]" role="status">{{ saveState.success }}</p>
    </section>
    <SectionPanel
      eyebrow="Admin"
      title="Parametros de SLA e criticidade"
      description="Ajuste os niveis oficiais e veja como as regras mudam a leitura dos casos existentes."
    >
      <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Criticidade</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ runtime.criticalityLevels.length }} niveis oficiais</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Ajuste nome, cor, badge e prioridade operacional de cada nivel.
            </p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Prazos</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ runtime.slaLevels.length }} janelas oficiais</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              A leitura reaproveita os mesmos casos do painel, da fila operacional e da auditoria.
            </p>
          </div>
        </div>

        <div class="inner-panel p-5">
          <p class="text-sm font-semibold text-slate-500">Base de impacto</p>
          <p class="mt-3 text-lg font-semibold text-slate-950">{{ dashboardData.activeCases.length }} casos ativos em leitura</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Regras por tema, subtema ou fila mudam a leitura projetada sem alterar o backend nesta etapa.
          </p>
        </div>
      </div>
    </SectionPanel>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <SectionPanel
        eyebrow="Criticidade"
        title="Niveis oficiais"
        description="Revise os niveis de criticidade e ajuste como eles aparecem na operacao."
      >
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="level in runtime.criticalityLevels"
              :key="level.key"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedCriticalityKey === level.key }"
              @click="selectCriticalityLevel(level.key)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">
                    {{ level.key }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ level.label }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">{{ level.note }}</p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="badge-base"
                    :style="level.style"
                  >
                    {{ level.badgeLabel }}
                  </span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>
          </div>

          <div v-if="selectedCriticalityLevel" class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="badge-base"
                :style="{ backgroundColor: selectedCriticalityLevel.backgroundColor, color: selectedCriticalityLevel.textColor }"
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
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Texto do badge</span>
                <input
                  v-model="selectedCriticalityLevel.badgeLabel"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor de fundo</span>
                <input
                  v-model="selectedCriticalityLevel.backgroundColor"
                  type="color"
                  class="h-12 rounded-[18px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor do texto</span>
                <input
                  v-model="selectedCriticalityLevel.textColor"
                  type="color"
                  class="h-12 rounded-[18px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2 md:col-span-2">
                <span class="text-sm font-semibold text-slate-600">Prioridade operacional</span>
                <input
                  v-model.number="selectedCriticalityLevel.operationalPriority"
                  type="number"
                  min="1"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="SLA"
        title="Janelas oficiais"
        description="Revise os prazos oficiais e ajuste como eles aparecem na operacao."
      >
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="level in runtime.slaLevels"
              :key="level.key"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedSlaKey === level.key }"
              @click="selectSlaLevel(level.key)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">
                    {{ level.key }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ level.label }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">{{ level.note }}</p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="badge-base"
                    :style="level.style"
                  >
                    {{ level.badgeLabel }}
                  </span>
                  <StatusBadge :label="`Prioridade ${level.operationalPriority}`" />
                </div>
              </div>
            </button>
          </div>

          <div v-if="selectedSlaLevel" class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="badge-base"
                :style="{ backgroundColor: selectedSlaLevel.backgroundColor, color: selectedSlaLevel.textColor }"
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
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Texto do badge</span>
                <input
                  v-model="selectedSlaLevel.badgeLabel"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor de fundo</span>
                <input
                  v-model="selectedSlaLevel.backgroundColor"
                  type="color"
                  class="h-12 rounded-[18px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Cor do texto</span>
                <input
                  v-model="selectedSlaLevel.textColor"
                  type="color"
                  class="h-12 rounded-[18px] border border-slate-200 bg-white px-2 py-2"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Horas</span>
                <input
                  v-model.number="selectedSlaLevel.hours"
                  type="number"
                  min="1"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Prioridade operacional</span>
                <input
                  v-model.number="selectedSlaLevel.operationalPriority"
                  type="number"
                  min="1"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <SectionPanel
        eyebrow="Regras"
        title="Aplicacao por tema, subtema e fila"
        description="Defina onde cada regra deve valer e acompanhe o impacto dessa leitura."
      >
        <div class="grid gap-4">
          <div class="grid gap-2">
            <button
              v-for="rule in runtime.rules"
              :key="rule.id"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedRuleId === rule.id }"
              @click="selectRule(rule.id)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500">
                    {{ rule.targetType }} - {{ rule.id }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">
                    {{ rule.targetType === 'queue' ? rule.targetValue : rule.targetValue.replaceAll('_', ' ') }}
                  </p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">{{ rule.note }}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <StatusBadge :label="rule.active ? 'Ativa' : 'Inativa'" />
                  <StatusBadge :label="rule.criticalityKey" />
                  <SlaBadge :label="rule.slaKey" />
                </div>
              </div>
            </button>
          </div>

          <div v-if="selectedRule" class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Tipo de alvo</span>
                <select
                  v-model="selectedRule.targetType"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <option
                    v-for="option in runtime.targetOptions.targetTypes"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Valor do alvo</span>
                <select
                  v-model="selectedRule.targetValue"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <option
                    v-for="option in currentRuleTargetOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Criticidade aplicada</span>
                <select
                  v-model="selectedRule.criticalityKey"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <option
                    v-for="level in runtime.criticalityLevels"
                    :key="level.key"
                    :value="level.key"
                  >
                    {{ level.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-600">Prazo aplicado</span>
                <select
                  v-model="selectedRule.slaKey"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <option
                    v-for="level in runtime.slaLevels"
                    :key="level.key"
                    :value="level.key"
                  >
                    {{ level.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-2 md:col-span-2">
                <span class="text-sm font-semibold text-slate-600">Observacao operacional</span>
                <textarea
                  v-model="selectedRule.note"
                  rows="4"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                ></textarea>
              </label>
            </div>

            <div
              v-if="selectedRuleImpact"
              :class="[
                'rounded-[16px] border px-4 py-4',
                selectedRuleImpact.impactScope === 'amplo'
                  ? 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.58)]'
                  : selectedRuleImpact.impactScope === 'local'
                    ? 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.55)]'
                    : 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.58)]',
              ]"
            >
              <p class="text-sm font-semibold text-slate-900">
                Impacto estimado da regra: {{ selectedRuleImpact.targetLabel }}
              </p>
              <p class="mt-2 text-sm leading-6 text-slate-700">
                Escopo {{ selectedRuleImpact.impactScope }}. {{ selectedRuleImpact.impactedCases }} caso(s) podem ser alterados nesta leitura.
              </p>
              <p class="mt-1 text-xs text-slate-600">
                {{ selectedRuleImpact.highCriticalityCases }} caso(s) podem subir criticidade e {{ selectedRuleImpact.shorterSlaCases }} podem reduzir SLA.
              </p>
            </div>

            <label class="inner-panel flex items-center justify-between gap-3 p-4">
              <span class="text-sm font-semibold text-slate-900">Regra ativa</span>
              <input
                v-model="selectedRule.active"
                type="checkbox"
              />
            </label>

            <div class="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
              <p class="text-sm font-semibold text-slate-900">Preparacao para rollback</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Nesta rodada o rollback ainda e manual por historico de auditoria. A proxima etapa deve salvar versao anterior e permitir restauracao em um clique.
              </p>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Impacto"
        title="Filas mais afetadas"
        description="Veja em quais filas a leitura de criticidade e prazo mudaria mais."
      >
        <div v-if="runtime.queueImpact.length" class="grid gap-3">
          <article
            v-for="queue in runtime.queueImpact"
            :key="queue.queue"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fila</p>
                
                <h3 class="mt-3 text-xl font-semibold text-slate-950">{{ queue.queue }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Tema dominante: {{ queue.dominantTheme }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="`${queue.highCriticalityCases} alta/critica`" />
                <SlaBadge :label="`${queue.shorterSlaCases} SLA mais curto`" />
              </div>
            </div>

            <div class="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-500">Casos impactados</p>
                <p class="mt-2 font-semibold text-slate-900">{{ queue.impactedCases }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-500">Alta criticidade</p>
                <p class="mt-2 font-semibold text-slate-900">{{ queue.highCriticalityCases }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-500">Prazo mais curto</p>
                <p class="mt-2 font-semibold text-slate-900">{{ queue.shorterSlaCases }}</p>
              </div>
            </div>
          </article>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <SectionPanel
        eyebrow="Impacto"
        title="Casos que ficariam com criticidade alta"
        description="Casos que passariam a exigir leitura mais sensivel com a combinacao atual."
      >
        <div v-if="runtime.highCriticalityCases.length" class="grid gap-3">
          <article
            v-for="item in runtime.highCriticalityCases"
            :key="item.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{{ item.id }}</p>
                
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ item.student }} - {{ item.queue }} - {{ item.theme }} / {{ item.subsubject }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="badge-base" :style="item.baselineCriticality.style">
                  {{ item.baselineCriticality.badgeLabel }}
                </span>
                <span class="badge-base" :style="item.projectedCriticality.style">
                  {{ item.projectedCriticality.badgeLabel }}
                </span>
              </div>
            </div>

            <p class="mt-4 text-sm leading-6 text-slate-600">
              Regras consideradas:
              {{ item.matchedRules.map((rule) => `${rule.targetType}:${rule.targetLabel}`).join(', ') || 'nenhuma' }}
            </p>
          </article>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Impacto"
        title="Casos com SLA mais curto"
        description="Casos cujo prazo inicial ficaria mais curto do que a leitura atual."
      >
        <div v-if="runtime.shorterSlaCases.length" class="grid gap-3">
          <article
            v-for="item in runtime.shorterSlaCases"
            :key="item.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{{ item.id }}</p>
                
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ item.student }} - {{ item.queue }} - {{ item.theme }} / {{ item.subsubject }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="badge-base" :style="item.baselineSla.style">
                  {{ item.baselineSla.badgeLabel }}
                </span>
                <span class="badge-base" :style="item.projectedSla.style">
                  {{ item.projectedSla.badgeLabel }}
                </span>
              </div>
            </div>

            <p class="mt-4 text-sm leading-6 text-slate-600">
              Regras consideradas:
              {{ item.matchedRules.map((rule) => `${rule.targetType}:${rule.targetLabel}`).join(', ') || 'nenhuma' }}
            </p>
          </article>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
