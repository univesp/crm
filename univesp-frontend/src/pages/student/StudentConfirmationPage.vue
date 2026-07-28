<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const studentSupportStore = useStudentSupportStore()

const protocolId = computed(() => String(route.params.protocolId || ''))
const protocol = computed(() =>
  protocolId.value === 'faq-resolvida' ? null : studentSupportStore.findLocalProtocolById(protocolId.value),
)
const resolvedState = computed(() =>
  protocolId.value === 'faq-resolvida' ? studentSupportStore.resolvedState : null,
)

const pageContent = computed(() => {
  if (protocol.value) {
    return {
      eyebrow: 'Solicitação enviada',
      title: 'Solicitação enviada com sucesso',
      description: 'Seu protocolo foi registrado e agora pode ser acompanhado no portal.',
      highlightLabel: 'O que foi registrado',
      highlight: protocol.value.protocolNumber,
      helperTitle: 'Qual é o próximo passo',
      helper: 'As próximas atualizações ficam em Minhas solicitações.',
      primaryLabel: 'Acompanhar solicitação',
      primaryRoute: `/aluno/solicitacoes/${protocol.value.protocolNumber}`,
      secondaryLabel: 'Voltar ao início',
      secondaryRoute: '/aluno',
      asideTitle: 'O que acontece agora',
      asideItems: [
        'Seu protocolo já está registrado no portal.',
        'Use Minhas solicitações para acompanhar as próximas atualizações.',
      ],
    }
  }

  if (resolvedState.value) {
    return {
      eyebrow: 'Resposta registrada',
      title: 'Resposta registrada no portal',
      description: resolvedState.value.message,
      highlightLabel: 'Registro gerado',
      highlight: resolvedState.value.recordId,
      helperTitle: 'Qual é o próximo passo',
      helper: resolvedState.value.helper,
      primaryLabel: 'Ver minhas solicitações',
      primaryRoute: '/aluno/solicitacoes',
      secondaryLabel: 'Voltar ao início',
      secondaryRoute: '/aluno',
      asideTitle: 'Registro no portal',
      asideItems: [
        'Essa orientação ficou registrada para consulta futura.',
        'Ela aparece na lista como Respondida no portal.',
      ],
    }
  }

  return {
    eyebrow: 'Etapa concluída',
    title: 'Registro concluído',
    description: 'O portal registrou esta etapa do atendimento.',
    highlightLabel: 'Registro',
    highlight: protocolId.value || 'Atendimento',
    helperTitle: 'Qual é o próximo passo',
    helper: 'Você pode voltar ao inicio ou acompanhar suas solicitações.',
    primaryLabel: 'Voltar ao início',
    primaryRoute: '/aluno',
    secondaryLabel: 'Ver minhas solicitações',
    secondaryRoute: '/aluno/solicitacoes',
    asideTitle: 'Apoio',
    asideItems: ['Os registros permanecem disponíveis no portal.'],
  }
})
</script>

<template>
  <StudentStageLayout
    :eyebrow="pageContent.eyebrow"
    :title="pageContent.title"
    :description="pageContent.description"
    :mobile-label="pageContent.eyebrow"
    :aside-title="pageContent.asideTitle"
  >
    <div class="grid max-w-xl gap-4">
      <div
        class="rounded-[8px] border border-[rgba(209,50,57,0.16)] bg-white p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(209,50,57,0.12)] text-2xl font-semibold text-[var(--color-primary-dark)]">
          &#10003;
        </div>
        <h2 class="mt-4 text-[1.85rem] font-semibold leading-tight text-slate-950">
          {{ pageContent.title }}
        </h2>
        <p class="mt-3 text-sm leading-7 text-slate-600">
          {{ pageContent.description }}
        </p>

        <div class="mt-5 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-center">
          <p class="student-section-label">{{ pageContent.highlightLabel }}</p>
          <p class="mt-1.5 text-base font-semibold text-slate-900">{{ pageContent.highlight }}</p>
        </div>
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-900">{{ pageContent.helperTitle }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          {{ pageContent.helper }}
        </p>

        <div class="crm-split-grid mt-5 gap-3">
          <RouterLink
            :to="pageContent.primaryRoute"
            class="student-focus-ring min-w-0 rounded-[8px] bg-[var(--color-primary)] px-5 py-4 text-center text-sm font-semibold leading-5 text-white shadow-sm hover:bg-slate-50"
          >
            {{ pageContent.primaryLabel }}
          </RouterLink>
          <RouterLink
            :to="pageContent.secondaryRoute"
            class="student-focus-ring min-w-0 rounded-[8px] border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-slate-700 hover:bg-slate-50"
          >
            {{ pageContent.secondaryLabel }}
          </RouterLink>
        </div>
      </div>
    </div>

    <template #aside>
      <div class="grid gap-3">
        <div
          v-for="item in pageContent.asideItems"
          :key="item"
          class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4 text-sm leading-6 text-slate-600"
        >
          {{ item }}
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
