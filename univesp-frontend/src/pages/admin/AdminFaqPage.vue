<script setup>
import ActionTile from '@/components/ActionTile.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { faqAdminSettings } from '../../../mocks/faqAdminSettings'
import { faqGovernanceSnapshot, operatorPlaybookTree, studentFaqTree } from '../../../mocks/knowledgeBase'
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
    <SectionPanel
      eyebrow="Admin"
      title="Gestao visual da FAQ"
      description="Estrutura inicial para governar a FAQ do aluno e a FAQ operacional do OP."
    >
      <div class="grid gap-3">
        <div
          v-for="faq in faqGovernanceSnapshot"
          :key="faq.id"
          class="inner-panel p-5"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-950">{{ faq.title }}</h3>
              <p class="mt-2 text-sm text-slate-600">Owner: {{ faq.owner }}</p>
            </div>
            <StatusBadge :label="faq.status" />
          </div>
          <p class="mt-4 text-sm leading-6 text-slate-700">Itens cadastrados: {{ faq.items }}</p>
        </div>
      </div>
    </SectionPanel>

    <SectionPanel
      eyebrow="Estrutura"
      title="Conteudo em governanca"
      description="Resumo visual das bases de conhecimento que o admin precisa controlar."
    >
      <ActionTile
        title="FAQ do aluno"
        :description="`${studentFaqTree.length} categorias principais para navegacao guiada.`"
        eyebrow="Base publica"
      />
      <ActionTile
        title="FAQ operacional do OP"
        :description="`${operatorPlaybookTree.length} blocos de playbook para resolucao e escalonamento.`"
        eyebrow="Base operacional"
      />
      <ActionTile
        title="Mensagem de encerramento do aluno"
        :description="faqAdminSettings.studentResolvedState.message"
        eyebrow="Configuracao local"
      />
    </SectionPanel>
  </div>
</template>
