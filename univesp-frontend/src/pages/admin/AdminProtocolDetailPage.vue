<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import OperationalInterventionBanner from '@/components/operational/OperationalInterventionBanner.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AsyncPanel from '@/components/ui/AsyncPanel.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { getTicket, isMockRuntimeEnabled } from '@/services/appApi'
import { buildProtocolAuditTimeline } from '@/services/protocolAuditRuntime'
import {
  buildAdminOperationalLinks,
  buildInterventionContext,
  parseInterventionQuery,
} from '@/services/operationalInterventionRuntime'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const { loading, error, run } = useAsyncAction()
const protocol = ref(null)

const protocolId = computed(() => String(route.params.protocolId || '').trim())
const auditTimeline = computed(() => {
  if (!protocol.value) {
    return []
  }

  const dashboardData = isMockRuntimeEnabled()
    ? studentSupportStore.adminDashboardData(auth.mockContext)
    : { auditEntries: [] }

  return buildProtocolAuditTimeline({
    caseId: protocol.value.protocolNumber || protocolId.value,
    dashboardData,
    interactions: protocol.value.timeline || [],
  })
})
const intervention = computed(() => parseInterventionQuery(route.query))
const interventionContext = computed(() =>
  protocol.value
    ? buildInterventionContext({
        intervention: intervention.value,
        detail: protocol.value,
        currentUser: auth.mockContext.userName,
      })
    : null,
)
const adminOperationalLinks = computed(() =>
  protocol.value ? buildAdminOperationalLinks(protocol.value) : [],
)

function dismissIntervention() {
  const nextQuery = { ...route.query }
  delete nextQuery.intervene
  delete nextQuery.intent
  router.replace({ query: nextQuery })
}

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
      <OperationalInterventionBanner
        v-if="interventionContext"
        :context="interventionContext"
        :operational-links="adminOperationalLinks"
        @dismiss="dismissIntervention"
      />

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
              <dd class="text-slate-900">{{ protocol.studentData?.nome || protocol.student || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">RA</dt>
              <dd class="text-slate-900">{{ protocol.studentData?.ra || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">E-mail</dt>
              <dd class="text-slate-900">{{ protocol.studentData?.email || 'Não informado' }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-500">Polo</dt>
              <dd class="text-slate-900">{{ protocol.studentData?.polo || protocol.polo || 'Não informado' }}</dd>
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
        <div>
          <h3 class="text-sm font-semibold text-slate-900">Auditoria do caso</h3>
          <p class="mt-1 text-xs text-slate-600">
            Movimentações auditáveis e interações registradas neste protocolo, unificadas em uma única trilha.
          </p>
        </div>

        <div v-if="auditTimeline.length" class="mt-4 grid gap-3">
          <article
            v-for="event in auditTimeline"
            :key="event.id || `${event.atLabel}-${event.title}`"
            class="rounded-ui border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-slate-900">{{ event.title }}</p>
                <StatusBadge
                  v-if="event.kind === 'audit'"
                  :label="event.kind === 'audit' ? 'Auditoria' : 'Interacao'"
                />
              </div>
              <p class="text-xs text-slate-500">{{ event.atLabel }}</p>
            </div>

            <p class="mt-2 text-xs font-semibold text-slate-600">{{ event.actor }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">
              {{ event.description || 'Atualização registrada.' }}
            </p>

            <div
              v-if="event.kind === 'audit' && (event.statusBefore || event.queueBefore)"
              class="mt-3 grid gap-2 md:grid-cols-2"
            >
              <div class="rounded-[8px] bg-white px-3 py-2">
                <p class="text-xs font-semibold text-slate-400">Antes</p>
                <p class="mt-1 text-xs font-semibold text-slate-900">{{ event.statusBefore }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ event.queueBefore }}</p>
              </div>
              <div class="rounded-[8px] bg-white px-3 py-2">
                <p class="text-xs font-semibold text-slate-400">Depois</p>
                <p class="mt-1 text-xs font-semibold text-slate-900">{{ event.statusAfter }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ event.queueAfter }}</p>
              </div>
            </div>

            <p v-if="event.escalationReason" class="mt-2 text-xs text-slate-500">
              Motivo: {{ event.escalationReason }}
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
