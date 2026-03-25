<script setup>
import { computed } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useStudentSupportStore } from '@/stores/studentSupport'
import { studentNotifications } from '../../../mocks/operations'

const studentSupportStore = useStudentSupportStore()

const requestGroups = computed(() => studentSupportStore.requestGroups)
const latestProtocol = computed(() => studentSupportStore.latestProtocol)

const sections = [
  {
    key: 'drafts',
    title: 'Rascunhos',
    description: 'Protocolos iniciados a partir da FAQ e ainda nao enviados.',
    empty: 'Nenhum rascunho ativo no momento.',
  },
  {
    key: 'submitted',
    title: 'Protocolos enviados',
    description: 'Casos que ja foram enviados e aguardam acao da operacao.',
    empty: 'Nenhum protocolo enviado ainda.',
  },
  {
    key: 'resolvedByFaq',
    title: 'Resolvidos pela FAQ',
    description: 'Atendimentos encerrados no portal com registro interno.',
    empty: 'Nenhum atendimento resolvido pela FAQ ainda.',
  },
  {
    key: 'concluded',
    title: 'Concluidos',
    description: 'Protocolos finalizados e encerrados.',
    empty: 'Nenhum protocolo concluido nesta base mockada.',
  },
]
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
    <SectionPanel
      eyebrow="Aluno"
      title="Minhas solicitacoes"
      description="A area agora separa rascunhos, protocolos enviados, resolvidos pela FAQ e concluidos em blocos distintos."
    >
      <div class="grid gap-5">
        <section
          v-for="section in sections"
          :key="section.key"
          class="rounded-[26px] border border-slate-200 bg-white/80 p-5"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {{ section.title }}
              </p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ section.description }}</p>
            </div>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              {{ requestGroups[section.key].length }}
            </span>
          </div>

          <div v-if="requestGroups[section.key].length" class="mt-5 grid gap-3">
            <article
              v-for="protocol in requestGroups[section.key]"
              :key="protocol.id"
              class="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {{ protocol.id }}
                  </p>
                  <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ protocol.subject }}</h3>
                  <p class="mt-3 text-sm leading-6 text-slate-600">
                    Atualizado em {{ protocol.updatedAt }}. Pendencia atual: {{ protocol.pending }}.
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <StatusBadge :label="protocol.status" />
                  <StatusBadge :label="protocol.priority" />
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span class="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  SLA: {{ protocol.sla }}
                </span>
                <RouterLink
                  v-if="protocol.route"
                  :to="protocol.route"
                  class="rounded-full bg-[var(--color-primary)] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(209,50,57,0.16)]"
                >
                  Abrir detalhe
                </RouterLink>
              </div>
            </article>
          </div>

          <p v-else class="mt-5 text-sm leading-7 text-slate-600">
            {{ section.empty }}
          </p>
        </section>
      </div>
    </SectionPanel>

    <div class="grid gap-6">
      <SectionPanel
        eyebrow="Destaque"
        title="Ultimo protocolo enviado"
        description="Resumo rapido do atendimento mais recente iniciado pelo aluno em modo mock."
      >
        <div v-if="latestProtocol" class="inner-panel p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {{ latestProtocol.protocolNumber }}
          </p>
          <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ latestProtocol.subject }}</h3>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            {{ latestProtocol.statusLabel }}. Fila: {{ latestProtocol.queueLabel }}. SLA:
            {{ latestProtocol.slaLabel }}.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <StatusBadge :label="latestProtocol.statusLabel" />
            <StatusBadge :label="latestProtocol.priorityLabel" />
            <RouterLink
              :to="`/aluno/solicitacoes/${latestProtocol.protocolNumber}`"
              class="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(209,50,57,0.16)]"
            >
              Abrir timeline
            </RouterLink>
          </div>
        </div>
        <div v-else class="inner-panel p-5">
          <p class="text-sm leading-7 text-slate-600">
            Assim que um protocolo for enviado a partir da FAQ, ele aparece aqui com acesso direto
            ao detalhe individual.
          </p>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Notificacoes"
        title="Fila pessoal de alertas"
        description="Resumo das mensagens que devem aparecer no portal do aluno."
      >
        <div class="grid gap-3">
          <ActionTile
            v-for="notification in studentNotifications"
            :key="notification.id"
            :title="notification.title"
            :description="notification.message"
            eyebrow="Portal oficial"
          />
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
