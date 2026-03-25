<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const studentSupportStore = useStudentSupportStore()

const protocol = computed(() =>
  studentSupportStore.findLocalProtocolById(route.params.protocolId),
)

function goBackToRequests() {
  router.push('/aluno/solicitacoes')
}
function goBackToFaq() {
  router.push('/aluno')
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Aluno"
      title="Detalhe do protocolo"
      description="Timeline, contexto herdado da FAQ e historico de interacoes do atendimento em modo mock."
    >
      <template #action>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goBackToRequests"
          >
            Voltar para solicitacoes
          </button>
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goBackToFaq"
          >
            Voltar para FAQ
          </button>
        </div>
      </template>

      <div v-if="!protocol" class="inner-panel p-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Detalhe indisponivel
        </p>
        <h3 class="mt-3 text-2xl font-semibold text-slate-950">
          Este protocolo mockado ainda nao existe no estado local.
        </h3>
        <p class="mt-3 text-sm leading-7 text-slate-600">
          Envie um protocolo a partir da FAQ do aluno para ver aqui a timeline, os anexos e o
          historico de interacoes.
        </p>
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {{ protocol.protocolNumber }}
                </p>
                <h3 class="mt-3 text-2xl font-semibold text-slate-950">
                  {{ protocol.subject }}
                </h3>
                <p class="mt-3 text-sm leading-7 text-slate-600">
                  Criado em {{ protocol.createdAtLabel }} e enviado para {{ protocol.queueLabel }}.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="protocol.statusLabel" />
                <StatusBadge :label="protocol.priorityLabel" />
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Timeline do atendimento
            </p>
            <div class="mt-5 grid gap-4">
              <article
                v-for="item in protocol.timeline"
                :key="item.id"
                class="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 class="text-lg font-semibold text-slate-950">{{ item.title }}</h4>
                    <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
                  </div>
                  <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
                    {{ item.atLabel }}
                  </span>
                </div>
              </article>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Historico de interacoes
            </p>
            <div class="mt-5 grid gap-3">
              <article
                v-for="interaction in protocol.interactions"
                :key="interaction.id"
                class="rounded-[22px] border border-slate-200 bg-white p-5"
              >
                <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-slate-950">{{ interaction.actor }}</p>
                    <p class="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {{ interaction.channel }}
                    </p>
                  </div>
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {{ interaction.atLabel }}
                  </span>
                </div>
                <p class="mt-3 text-sm leading-7 text-slate-700">{{ interaction.text }}</p>
              </article>
            </div>
          </div>
        </div>

        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Contexto herdado da FAQ
            </p>
            <div class="mt-5 grid gap-4">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ protocol.context.theme }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subtema</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ protocol.context.subtheme || 'Nao informado' }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Breadcrumb</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">{{ protocol.context.breadcrumb.join(' > ') }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">No final</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ protocol.context.finalNode.title }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta exibida</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">{{ protocol.context.displayedAnswer }}</p>
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Anexos mockados
            </p>
            <div v-if="protocol.attachments.length" class="mt-5 grid gap-3">
              <div
                v-for="attachment in protocol.attachments"
                :key="attachment.id"
                class="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <p class="text-sm font-semibold text-slate-900">{{ attachment.name }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ attachment.status }}</p>
              </div>
            </div>
            <p v-else class="mt-4 text-sm leading-7 text-slate-600">
              Nenhum anexo foi enviado neste protocolo mockado.
            </p>
          </div>
        </div>
      </div>
    </SectionPanel>
  </div>
</template>
