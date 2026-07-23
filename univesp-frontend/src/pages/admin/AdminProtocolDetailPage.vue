<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AsyncPanel from '@/components/ui/AsyncPanel.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { getTicket, isMockRuntimeEnabled } from '@/services/appApi'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const { loading, error, run } = useAsyncAction()
const protocol = ref(null)

const protocolId = computed(() => String(route.params.protocolId || '').trim())
const timeline = computed(() => protocol.value?.timeline || [])
const studentData = computed(() => protocol.value?.studentData || {})
const auditLink = computed(() => ({
  name: 'admin-audit',
  query: { protocol: protocol.value?.protocolNumber || protocolId.value },
}))

async function loadProtocol() {
  await run(async () => {
    if (isMockRuntimeEnabled()) {
      const dashboard = studentSupportStore.adminDashboardData(auth.mockContext)
      const match =
        dashboard.activeCases.find((entry) => entry.id === protocolId.value) ||
        dashboard.historicalAttendances.find((entry) => entry.id === protocolId.value)

      if (!match) {
        throw new Error('Protocolo não encontrado no simulador.')
      }

      protocol.value = {
        ...match,
        protocolNumber: match.id,
        studentData: match.studentData || {
          nome: match.student,
          polo: match.polo,
        },
        timeline: (match.interactions || []).map((item, index) => ({
          id: `mock-${index}`,
          title: item.actor || 'Atualização',
          actor: item.actor || 'Atualização',
          description: item.text || item.message || '',
          atLabel: match.updatedAtLabel || match.createdAtLabel || 'Não informado',
        })),
      }
      return match
    }

    const response = await getTicket(protocolId.value)
    protocol.value = mapApiTicketToOperationalProtocol(response.data || {})
    return response
  }, {
    errorFallback: 'Não foi possível abrir este protocolo.',
  })
}

onMounted(loadProtocol)
</script>

<template>
  <div class="grid gap-5">
    <section class="surface-panel p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Detalhe do protocolo</p>
          <h2 class="mt-2 text-xl font-semibold text-slate-950">
            {{ protocol?.subject || 'Carregando protocolo...' }}
          </h2>
          <p v-if="protocol" class="mt-2 text-sm text-slate-600">
            {{ protocol.protocolNumber || protocolId }} - atualizado em
            {{ protocol.updatedAtLabel || protocol.createdAtLabel || 'Não informado' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <SgpButton variant="secondary" to="/admin/protocolos">Voltar ao diretório</SgpButton>
          <SgpButton variant="secondary" :to="auditLink">Auditoria deste caso</SgpButton>
        </div>
      </div>
    </section>

    <AsyncPanel
      :loading="loading"
      :error="error"
      :is-empty="!protocol"
      loading-message="Abrindo protocolo..."
      empty-title="Protocolo não encontrado"
      empty-message="Confira o número informado ou volte ao diretório de protocolos."
      empty-next-step="Use a busca global no cabeçalho para localizar um protocolo pelo número exato."
      @retry="loadProtocol"
    >
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section class="inner-panel p-5">
          <h3 class="text-sm font-semibold text-slate-900">Resumo do atendimento</h3>
          <p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
            {{ protocol.description || 'Sem descrição registrada.' }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <PriorityBadge :priority="protocol.priorityLabel || protocol.criticality" />
            <StatusBadge :label="protocol.statusLabel || protocol.status" />
            <SlaBadge :label="protocol.slaLabel || protocol.sla || 'SLA não calculado'" />
            <StatusBadge :label="protocol.queueLabel || protocol.queue || 'Fila não informada'" />
          </div>
        </section>

        <section class="inner-panel p-5">
          <h3 class="text-sm font-semibold text-slate-900">Aluno e encaminhamento</h3>
          <dl class="mt-4 grid gap-3 text-sm">
            <div>
              <dt class="font-semibold text-slate-500">Aluno</dt>
              <dd class="text-slate-900">{{ studentData.nome || protocol.student || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">RA</dt>
              <dd class="text-slate-900">{{ studentData.ra || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">E-mail</dt>
              <dd class="text-slate-900">{{ studentData.email || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">Polo</dt>
              <dd class="text-slate-900">{{ studentData.polo || protocol.polo || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">Fila / área</dt>
              <dd class="text-slate-900">
                {{ protocol.queueLabel || protocol.queue || 'Não informado' }}
                <span v-if="protocol.currentAreaLabel || protocol.lastMileAreaLabel">
                  - {{ protocol.currentAreaLabel || protocol.lastMileAreaLabel }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">Responsável</dt>
              <dd class="text-slate-900">{{ protocol.assignedOperator || 'Não atribuído' }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="inner-panel p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">Histórico / timeline</h3>
            <p class="mt-1 text-xs text-slate-600">
              Movimentações registradas neste protocolo, do mais recente ao mais antigo quando disponível.
            </p>
          </div>
          <RouterLink :to="auditLink" class="text-xs font-semibold text-[var(--color-primary)]">
            Abrir auditoria completa &rarr;
          </RouterLink>
        </div>

        <div v-if="timeline.length" class="mt-4 grid gap-3">
          <article
            v-for="event in timeline"
            :key="event.id || `${event.atLabel}-${event.title}`"
            class="rounded-ui border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-900">{{ event.title || event.actor }}</p>
              <p class="text-xs text-slate-500">{{ event.atLabel || event.at || 'Não informado' }}</p>
            </div>
            <p class="mt-2 text-sm leading-6 text-slate-700">
              {{ event.description || event.message || 'Atualização registrada.' }}
            </p>
          </article>
        </div>
        <p v-else class="mt-4 text-sm text-slate-600">
          Nenhuma movimentação detalhada disponível para este protocolo ainda.
        </p>
      </section>
    </AsyncPanel>
  </div>
</template>
