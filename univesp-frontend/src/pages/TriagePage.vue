<script setup>
import { computed } from 'vue'

import QuestionStep from '@/components/QuestionStep.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { attendanceFlows } from '@/data/flowBlueprint'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()

const activeFlow = computed(() => journey.activeFlow)
const answerSummary = computed(() => journey.answerSummary)

function handleSelectFlow(flowId) {
  journey.selectFlow(flowId)
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[0.9fr_1.25fr_0.85fr]">
    <SectionPanel
      eyebrow="Catalogo"
      title="Fluxos prontos para o primeiro atendimento"
      description="Cada card representa um fluxo com perguntas iniciais fechadas. A ideia e o operador ou o proprio aluno navegar por esse roteiro com o minimo de friccao."
    >
      <div class="grid gap-3">
        <button
          v-for="flow in attendanceFlows"
          :key="flow.id"
          type="button"
          :class="[
            'option-button',
            activeFlow.id === flow.id ? 'is-active' : '',
          ]"
          @click="handleSelectFlow(flow.id)"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ flow.name }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ flow.summary }}</p>
            </div>
            <span class="soft-chip">{{ flow.expectedSla }}</span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span class="rounded-full bg-slate-100 px-3 py-1">Fila: {{ flow.queue }}</span>
            <span class="rounded-full bg-slate-100 px-3 py-1">Perguntas: {{ flow.questions.length }}</span>
          </div>
        </button>
      </div>
    </SectionPanel>

    <SectionPanel
      eyebrow="Triagem"
      :title="activeFlow.name"
      :description="activeFlow.summary"
    >
      <template #action>
        <div class="soft-chip">{{ journey.completion }}% preenchido</div>
      </template>

      <div class="mb-5 flex flex-wrap gap-2">
        <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Fila: {{ activeFlow.queue }}
        </span>
        <span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          SLA: {{ activeFlow.expectedSla }}
        </span>
        <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
          Canal: {{ journey.customer.channel }}
        </span>
      </div>

      <div class="grid gap-4">
        <QuestionStep
          v-for="(question, index) in activeFlow.questions"
          :key="question.id"
          :index="index + 1"
          :question="question"
          :model-value="journey.answers[question.id]"
          @update:model-value="journey.answer(question.id, $event)"
        />
      </div>
    </SectionPanel>

    <div class="grid gap-6">
      <SectionPanel
        eyebrow="Snapshot"
        title="Contexto que segue para o ticket"
        description="Esses dados devem aparecer em toda a cadeia de atendimento para evitar retrabalho."
      >
        <div class="grid gap-3">
          <div
            v-for="item in answerSummary"
            :key="item.questionId"
            class="inner-panel p-4"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {{ item.question }}
            </p>
            <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.answer }}</p>
          </div>
        </div>

        <div class="mt-5 rounded-[24px] bg-amber-50 p-5 text-amber-900">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
            Proxima decisao
          </p>
          <p class="mt-3 text-sm leading-6">
            Quando a triagem estiver pronta, o sistema abre ou atualiza um ticket e compartilha esse
            contexto com a IA.
          </p>
        </div>

        <RouterLink
          to="/ticket"
          class="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Ir para o contrato do ticket
        </RouterLink>
      </SectionPanel>

      <SectionPanel
        eyebrow="Campos minimos"
        title="Dados que devem vir do SSO ou formulario"
        description="Mesmo no prototipo, vale deixar claro o minimo de dados obrigatorios."
      >
        <div class="grid gap-3">
          <div
            v-for="field in activeFlow.keyFields"
            :key="field"
            class="inner-panel flex items-center justify-between px-4 py-3"
          >
            <span class="text-sm font-medium text-slate-900">{{ field }}</span>
            <span class="soft-chip">Obrigatorio</span>
          </div>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
