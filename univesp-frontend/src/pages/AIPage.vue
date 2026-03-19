<script setup>
import { computed } from 'vue'

import SectionPanel from '@/components/SectionPanel.vue'
import { aiGuardrails } from '@/services/aiOrchestrator'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()

const conversation = computed(() => journey.conversationPreview)
const botContext = computed(() => journey.botContext)
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <SectionPanel
      eyebrow="Chatbot"
      title="Conversa assistida com contexto do ticket"
      description="A IA entra depois da triagem e usa o ticket como fonte de verdade. O foco aqui e reduzir repeticao e decidir cedo quando precisa escalar."
    >
      <div class="grid gap-4">
        <div
          v-for="(message, index) in conversation"
          :key="`${message.role}-${index}`"
          :class="[
            'max-w-[92%] rounded-[24px] p-5',
            message.role === 'assistant'
              ? 'ml-auto bg-slate-950 text-white'
              : 'bg-amber-50 text-slate-900',
          ]"
        >
          <p
            :class="[
              'text-[11px] font-semibold uppercase tracking-[0.24em]',
              message.role === 'assistant' ? 'text-white/50' : 'text-slate-500',
            ]"
          >
            {{ message.speaker }}
          </p>
          <p class="mt-3 text-sm leading-7">{{ message.text }}</p>
        </div>
      </div>

      <div class="mt-5 rounded-[24px] bg-emerald-50 p-5 text-emerald-900">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Regra de escalacao
        </p>
        <p class="mt-3 text-sm leading-6">
          Se a IA nao conseguir fechar o caso com base no playbook, o resumo deve ser salvo no
          ticket e enviado ao atendente junto do protocolo.
        </p>
      </div>
    </SectionPanel>

    <div class="grid gap-6">
      <SectionPanel
        eyebrow="Contexto"
        title="Carga de contexto para o bot"
        description="Isso ilustra o pacote minimo que precisa acompanhar a sessao da IA."
      >
        <pre class="inner-panel overflow-x-auto p-4 text-xs leading-6 text-slate-700">{{
JSON.stringify(botContext, null, 2)
        }}</pre>
      </SectionPanel>

      <SectionPanel
        eyebrow="Guardrails"
        title="Regras de seguranca e operacao"
        description="Essas restricoes precisam estar explicitas para o chatbot nao virar um desvio de processo."
      >
        <div class="grid gap-3">
          <div
            v-for="rule in aiGuardrails"
            :key="rule"
            class="inner-panel p-4 text-sm leading-6 text-slate-700"
          >
            {{ rule }}
          </div>
        </div>

        <RouterLink
          to="/handoff"
          class="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Ir para o handoff humano
        </RouterLink>
      </SectionPanel>
    </div>
  </div>
</template>
