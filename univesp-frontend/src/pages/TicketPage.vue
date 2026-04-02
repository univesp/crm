<script setup>
import { computed, ref } from 'vue'

import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { frappeModelNotes, submitTicketDraft } from '@/services/frappeClient'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()

const draft = computed(() => journey.ticketDraft)
const operations = computed(() => journey.frappeOperations)
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

function resolveTicketLabel(ticket) {
  if (!ticket || typeof ticket !== 'object') {
    return 'Ticket criado no Frappe CRM.'
  }

  const documentName = ticket.name || ticket.subject || ticket.title
  if (!documentName) {
    return 'Ticket criado no Frappe CRM.'
  }

  return `Ticket ${documentName} criado no Frappe CRM.`
}

async function handleSubmitTicket() {
  submitting.value = true
  submitError.value = ''
  submitSuccess.value = ''

  try {
    const ticket = await submitTicketDraft(draft.value)
    journey.setRemoteTicket(ticket)
    submitSuccess.value = resolveTicketLabel(ticket)
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : 'Falha ao criar o ticket no Frappe CRM.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Doctype alvo" :value="draft.doctype" hint="Placeholder configuravel por ambiente." />
      <MetricCard label="Fila sugerida" :value="draft.queue" hint="Resultado direto da triagem guiada." />
      <MetricCard label="SLA alvo" :value="draft.sla" hint="Usado para priorizar o atendimento." />
      <MetricCard label="Protocolo" :value="draft.protocol" hint="Referencia unica para ticket, fila e last mile." />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <SectionPanel
        eyebrow="Payload"
        title="Preview do ticket no Frappe"
        description="Use este bloco como contrato inicial entre o frontend e o backend. Ele mostra o que a tela deve enviar assim que a triagem termina."
      >
        <template #action>
          <button
            type="button"
            class="login-primary-button"
            :disabled="submitting"
            @click="handleSubmitTicket"
          >
            {{ submitting ? 'Enviando...' : 'Criar ticket no Frappe' }}
          </button>
        </template>

        <div v-if="submitSuccess" class="login-banner is-success mb-5">
          {{ submitSuccess }}
        </div>

        <div v-if="submitError" class="login-banner is-danger mb-5">
          {{ submitError }}
        </div>

        <div class="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div class="grid gap-3">
            <div
              v-for="field in draft.fields"
              :key="field.label"
              class="inner-panel p-4"
            >
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {{ field.label }}
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ field.value }}</p>
            </div>
          </div>

          <pre class="inner-panel overflow-x-auto p-4 text-xs leading-6 text-slate-700">{{
JSON.stringify(draft.payload, null, 2)
          }}</pre>
        </div>
      </SectionPanel>

      <div class="grid gap-6">
        <SectionPanel
          eyebrow="Operacoes"
          title="Chamadas previstas"
          description="Sequencia sugerida para abrir o ticket, gravar contexto e preparar a continuidade humana."
        >
          <div class="grid gap-3">
            <div
              v-for="operation in operations"
              :key="operation.name"
              class="inner-panel p-4"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                  {{ operation.method }}
                </span>
                <p class="text-sm font-semibold text-slate-900">{{ operation.name }}</p>
              </div>
              <p class="mt-3 break-all text-sm leading-6 text-slate-600">{{ operation.endpoint }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ operation.detail }}</p>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Modelagem"
          title="Notas para o backend"
          description="Decisoes que valem ser fechadas cedo para evitar retrabalho entre CRM, filas e operacao."
        >
          <div class="grid gap-3">
            <div
              v-for="note in frappeModelNotes"
              :key="note"
              class="inner-panel p-4 text-sm leading-6 text-slate-700"
            >
              {{ note }}
            </div>
          </div>

          <div
            v-if="journey.remoteTicket"
            class="mt-5 inner-panel p-4 text-sm leading-6 text-slate-700"
          >
            Integracao ativa: o frontend ja criou um documento real no Frappe CRM e guardou o
            retorno mais recente desta sessao.
          </div>
        </SectionPanel>
      </div>
    </div>
  </div>
</template>
