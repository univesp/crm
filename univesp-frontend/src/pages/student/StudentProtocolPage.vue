<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SectionPanel from '@/components/SectionPanel.vue'
import { formatProtocolFieldLabel } from '@/services/studentSupportFlow'
import { useStudentSupportStore } from '@/stores/studentSupport'

const router = useRouter()
const studentSupportStore = useStudentSupportStore()
const hasAttemptedSubmit = ref(false)

const protocolDraft = computed(() => studentSupportStore.protocolDraft)
const faqContext = computed(() => studentSupportStore.currentFaqContext)
const requiredFields = computed(() => protocolDraft.value?.requiredFields || [])
const attachmentNames = computed(() => protocolDraft.value?.form.attachments || [])
const protocolValidation = computed(() => studentSupportStore.protocolValidation)
const fieldRules = computed(() => protocolValidation.value.rules)
const visibleErrors = computed(() => (hasAttemptedSubmit.value ? protocolValidation.value.errors : {}))

function goBackToFaq() {
  router.push('/aluno')
}

function goToRequests() {
  router.push('/aluno/solicitacoes')
}

function updateDescription(event) {
  studentSupportStore.updateProtocolField('description', event.target.value)
}

function handleAttachmentChange(event) {
  const attachmentList = Array.from(event.target.files || []).map((file) => file.name)
  studentSupportStore.setProtocolAttachments(attachmentList)
}

function submitProtocol() {
  hasAttemptedSubmit.value = true
  const result = studentSupportStore.submitProtocol()

  if (!result.ok) {
    return
  }

  router.push(`/aluno/solicitacoes/${result.protocol.protocolNumber}`)
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Aluno"
      title="Protocolo em modo mock"
      description="Primeira versao do protocolo iniciada a partir do no final da FAQ, com contexto reaproveitado e sem backend real."
    >
      <template #action>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goBackToFaq"
          >
            Voltar para FAQ
          </button>
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goToRequests"
          >
            Minhas solicitacoes
          </button>
        </div>
      </template>

      <div v-if="!protocolDraft || !faqContext" class="inner-panel p-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Protocolo indisponivel
        </p>
        <h3 class="mt-3 text-2xl font-semibold text-slate-950">
          Nenhum protocolo mockado foi iniciado ainda.
        </h3>
        <p class="mt-3 text-sm leading-7 text-slate-600">
          Navegue pela FAQ do aluno ate um no folha e clique em "Ainda preciso de atendimento" para
          abrir esta etapa com contexto pre-preenchido.
        </p>
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Protocolo iniciado
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950">
              {{ protocolDraft.title }}
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">
              {{ protocolDraft.description }}
            </p>

            <div class="mt-5 flex flex-wrap gap-2">
              <span class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]">
                {{ protocolDraft.sourceRecordId }}
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                {{ faqContext.queueDestination }}
              </span>
              <span class="rounded-full bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]">
                {{ faqContext.sla }}
              </span>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 ring-1 ring-slate-200">
                {{ faqContext.opensTicket ? 'Abre atendimento' : 'Continuacao forcada pelo aluno' }}
              </span>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Formulario inicial
            </p>

            <div
              v-if="visibleErrors.form"
              class="mt-5 rounded-[18px] border border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.88)] p-4 text-sm leading-6 text-[var(--color-danger)]"
            >
              {{ visibleErrors.form }}
            </div>

            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</span>
                <input
                  class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  :value="protocolDraft.form.theme"
                  readonly
                />
              </label>
              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subtema</span>
                <input
                  class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  :value="protocolDraft.form.subtheme || 'Nao informado'"
                  readonly
                />
              </label>
              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assunto</span>
                <input
                  class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  :value="protocolDraft.form.subject"
                  readonly
                />
              </label>
              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Breadcrumb</span>
                <input
                  class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  :value="protocolDraft.form.breadcrumb"
                  readonly
                />
              </label>
              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Descricao complementar
                  <span v-if="fieldRules.descriptionRequired" class="text-[var(--color-danger)]">*</span>
                </span>
                <textarea
                  rows="5"
                  :class="[
                    'rounded-[22px] border bg-white px-4 py-3 text-sm leading-6 text-slate-700',
                    visibleErrors.description ? 'border-[var(--color-danger)] bg-[rgba(253,236,237,0.5)]' : 'border-slate-200',
                  ]"
                  :value="protocolDraft.form.description"
                  placeholder="Explique o que ainda precisa de atendimento humano."
                  @input="updateDescription"
                />
                <p class="text-sm leading-6 text-slate-500">
                  {{ fieldRules.descriptionRequired ? 'Este campo e obrigatorio para enviar o protocolo.' : 'Este campo pode ser usado para complementar o contexto da FAQ.' }}
                </p>
                <p v-if="visibleErrors.description" class="text-sm leading-6 text-[var(--color-danger)]">
                  {{ visibleErrors.description }}
                </p>
              </label>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <span
                v-for="field in requiredFields"
                :key="field"
                class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                {{ formatProtocolFieldLabel(field) }}
              </span>
              <span
                v-if="!requiredFields.length"
                class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                descricao livre
              </span>
            </div>

            <div
              v-if="protocolDraft.allowsAttachment"
              :class="[
                'mt-5 rounded-[22px] border border-dashed p-5',
                visibleErrors.attachments
                  ? 'border-[var(--color-danger)] bg-[rgba(253,236,237,0.5)]'
                  : 'border-[rgba(209,50,57,0.24)] bg-[rgba(252,233,235,0.5)]',
              ]"
            >
              <p class="text-sm font-semibold text-slate-900">Anexos em modo mock</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                {{ fieldRules.attachmentRequired ? 'Este fluxo exige anexo antes do envio.' : 'O no final permite anexos opcionais neste protocolo mockado.' }}
              </p>
              <input
                class="mt-4 block text-sm text-slate-600"
                type="file"
                multiple
                @change="handleAttachmentChange"
              />
              <p v-if="visibleErrors.attachments" class="mt-3 text-sm leading-6 text-[var(--color-danger)]">
                {{ visibleErrors.attachments }}
              </p>
              <div v-if="attachmentNames.length" class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="attachment in attachmentNames"
                  :key="attachment"
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                >
                  {{ attachment }}
                </span>
              </div>
            </div>

            <div v-else class="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
              <p class="text-sm font-semibold text-slate-900">Anexos nao habilitados</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Este fluxo nao permite anexo no mock atual. O protocolo sera enviado apenas com o
                contexto herdado da FAQ e a descricao complementar.
              </p>
              <p
                v-if="visibleErrors.attachments"
                class="mt-3 text-sm leading-6 text-[var(--color-danger)]"
              >
                {{ visibleErrors.attachments }}
              </p>
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-[22px] bg-[var(--color-primary)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(209,50,57,0.18)] transition hover:-translate-y-1"
                @click="submitProtocol"
              >
                Enviar protocolo mockado
              </button>
              <button
                type="button"
                class="rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                @click="goBackToFaq"
              >
                Revisar na FAQ
              </button>
            </div>
          </div>
        </div>

        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Contexto reaproveitado da FAQ
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">
              {{ faqContext.finalNode.title }}
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">
              {{ faqContext.displayedAnswer }}
            </p>
          </div>

          <div class="inner-panel p-6">
            <div class="grid gap-4">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Acao sugerida</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ faqContext.action }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fila destino</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ faqContext.queueDestination }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Criticidade</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ faqContext.criticality }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">SLA</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ faqContext.sla }}</p>
              </div>
              <div v-if="faqContext.calendarHighlight">
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Destaque de calendario</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ faqContext.calendarHighlight.label }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionPanel>
  </div>
</template>
