<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { addTicketAttachments, createTicket, isMockRuntimeEnabled } from '@/services/appApi'
import { mapApiTicketToStudentProtocol } from '@/services/ticketMapper'
import { useStudentSupportStore } from '@/stores/studentSupport'

const router = useRouter()
const studentSupportStore = useStudentSupportStore()
const hasAttemptedSubmit = ref(false)
const isSubmitting = ref(false)
const formMessage = ref('')
const descriptionField = ref(null)
const attachmentField = ref(null)
const attachmentFiles = ref([])

const protocolDraft = computed(() => studentSupportStore.protocolDraft)
const faqContext = computed(() => studentSupportStore.currentFaqContext)
const attachmentNames = computed(() => protocolDraft.value?.form.attachments || [])
const protocolValidation = computed(() => studentSupportStore.protocolValidation)
const fieldRules = computed(() => protocolValidation.value.rules)
const visibleErrors = computed(() => (hasAttemptedSubmit.value ? protocolValidation.value.errors : {}))
const trailItems = computed(() => {
  if (!faqContext.value) {
    return []
  }

  return [
    { id: 'home', label: 'Inicio', route: '/aluno' },
    { id: 'journey', label: 'Tenho uma duvida', route: '/aluno/duvida' },
    ...faqContext.value.breadcrumb.map((step, index) => ({
      id: `${step}-${index}`,
      label: step,
      route: '/aluno/duvida',
    })),
    { id: 'protocol', label: 'Continuar atendimento', route: '/aluno/protocolo', current: true },
  ]
})

function goBackToFaq() {
  router.push('/aluno/duvida')
}

function updateDescription(event) {
  studentSupportStore.updateProtocolField('description', event.target.value)
}

function handleAttachmentChange(event) {
  attachmentFiles.value = Array.from(event.target.files || [])
  const attachmentList = attachmentFiles.value.map((file) => file.name)
  studentSupportStore.setProtocolAttachments(attachmentList)
}

async function submitProtocol() {
  if (isSubmitting.value) {
    return
  }

  hasAttemptedSubmit.value = true
  formMessage.value = ''
  isSubmitting.value = true
  if (!protocolValidation.value.isValid || !protocolDraft.value) {
    isSubmitting.value = false
    formMessage.value = 'Revise os campos destacados antes de enviar sua solicitacao.'
    nextTick(() => {
      if (protocolValidation.value.errors.description) descriptionField.value?.focus()
      else if (protocolValidation.value.errors.attachments) attachmentField.value?.focus()
    })
    return
  }

  if (!isMockRuntimeEnabled()) {
    try {
      const draft = protocolDraft.value
      const result = await createTicket({
        subject: draft.form.subject,
        description: draft.form.description,
        priority: draft.form.priority || 'medium',
        source: 'portal',
        queue: draft.form.ownerQueue || draft.form.queueDestination || '',
        area: draft.form.ownerArea || draft.form.routingArea || '',
        triage: {
          theme: draft.form.theme,
          subtheme: draft.form.subtheme,
          breadcrumb: draft.form.breadcrumb,
        },
        knowledge: {
          bundle_id: draft.form.bundleId,
          bundle_version_id: draft.form.bundleVersionId,
          node_id: draft.form.sourceNodeId,
        },
      })
      if (attachmentFiles.value.length) {
        await addTicketAttachments(result.data.id, attachmentFiles.value)
      }
      studentSupportStore.upsertLiveTicket(mapApiTicketToStudentProtocol(result.data))
      isSubmitting.value = false
      router.push(`/aluno/confirmacao/${result.data.protocol}`)
    } catch (error) {
      isSubmitting.value = false
      formMessage.value = error.message || 'Nao foi possivel enviar sua solicitacao agora.'
    }
    return
  }

  const result = studentSupportStore.submitProtocol()

  if (!result.ok) {
    isSubmitting.value = false
    formMessage.value = 'Revise os campos destacados antes de enviar sua solicitacao.'
    nextTick(() => {
      if (result.validation.errors.description) {
        descriptionField.value?.focus()
        return
      }

      if (result.validation.errors.attachments) {
        attachmentField.value?.focus()
      }
    })
    return
  }

  router.push(`/aluno/confirmacao/${result.protocol.protocolNumber}`)
}
</script>

<template>
  <StudentStageLayout
    eyebrow="Resumo da solicitacao"
    title="Continuar com a solicitacao"
    description="Revise o resumo abaixo e complemente apenas o que for necessario."
    :mobile-label="faqContext?.finalNode?.title || 'Continuar atendimento'"
    :show-back="true"
    aside-title="Seu caminho"
    aside-description="No desktop, esta coluna apenas resume o contexto aproveitado da navegacao."
    @back="goBackToFaq"
  >
    <div
      v-if="!protocolDraft || !faqContext"
      class="max-w-2xl rounded-[24px] border border-slate-200 bg-slate-50/80 p-6"
    >
      <p class="text-sm font-semibold text-slate-900">Solicitacao indisponivel</p>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Siga a jornada da duvida ate a orientacao oficial e escolha continuar atendimento para abrir esta etapa com o contexto preenchido.
      </p>
    </div>

    <div v-else class="grid max-w-2xl gap-4">
      <div class="rounded-[24px] border border-[rgba(109,76,255,0.16)] bg-[rgba(109,76,255,0.06)] p-5">
        <p class="text-sm font-semibold text-slate-950">Vamos dar continuidade para voce.</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          O portal aproveitou o caminho da sua navegacao para sugerir o assunto e reduzir o preenchimento.
        </p>
      </div>

      <div class="rounded-[24px] border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-900">Resumo da sua solicitacao</p>

        <div class="mt-4 grid gap-3">
          <div class="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tema</p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">{{ protocolDraft.form.theme }}</p>
          </div>

          <div class="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assunto</p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">{{ protocolDraft.form.subject }}</p>
          </div>

          <div class="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Resumo do caminho</p>
            <p class="mt-1.5 text-sm leading-6 text-slate-700">{{ protocolDraft.form.breadcrumb }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-[24px] border border-slate-200 bg-white p-5">
        <div
          v-if="formMessage"
          class="mb-5 rounded-[18px] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-danger)]"
          role="alert"
        >
          {{ formMessage }}
        </div>

        <label class="grid gap-3">
          <span id="protocol-description-label" class="text-sm font-semibold text-slate-900">
            Conte, em poucas palavras, o que ainda precisa de atendimento
            <span v-if="fieldRules.descriptionRequired" class="text-[var(--color-danger)]">*</span>
          </span>

          <textarea
            ref="descriptionField"
            rows="5"
            :class="[
              'student-focus-ring rounded-[20px] border px-4 py-3 text-sm leading-6 text-slate-700',
              visibleErrors.description ? 'border-[var(--color-danger)] bg-[rgba(253,236,237,0.5)]' : 'border-slate-200 bg-white',
            ]"
            :value="protocolDraft.form.description"
            placeholder="Explique o que ainda nao foi resolvido."
            :aria-invalid="visibleErrors.description ? 'true' : 'false'"
            :aria-describedby="visibleErrors.description ? 'protocol-description-error protocol-description-help' : 'protocol-description-help'"
            @input="updateDescription"
          />
        </label>

        <p id="protocol-description-help" class="mt-3 text-sm leading-6 text-slate-600">
          Descreva apenas o que ainda precisa de atendimento.
        </p>
        <p
          v-if="visibleErrors.description"
          id="protocol-description-error"
          class="mt-2 text-sm leading-6 text-[var(--color-danger)]"
          role="alert"
        >
          {{ visibleErrors.description }}
        </p>

        <div
          v-if="protocolDraft.allowsAttachment || visibleErrors.attachments"
          class="mt-5 rounded-[22px] border border-dashed border-[rgba(109,76,255,0.24)] bg-[rgba(109,76,255,0.04)] p-5"
        >
          <label
            for="student-protocol-attachment-input"
            class="text-sm font-semibold text-slate-900"
          >
            Anexar documento
          </label>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Adicionar um arquivo ajuda a contextualizar o atendimento.
          </p>

          <input
            id="student-protocol-attachment-input"
            ref="attachmentField"
            class="student-focus-ring mt-4 block rounded-[16px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600"
            type="file"
            multiple
            :aria-invalid="visibleErrors.attachments ? 'true' : 'false'"
            :aria-describedby="visibleErrors.attachments ? 'protocol-attachments-error protocol-attachments-help' : 'protocol-attachments-help'"
            @change="handleAttachmentChange"
          />

          <p id="protocol-attachments-help" class="mt-3 text-sm leading-6 text-slate-600">
            Envie apenas arquivos que ajudem a contextualizar o atendimento.
          </p>

          <p
            v-if="visibleErrors.attachments"
            id="protocol-attachments-error"
            class="mt-3 text-sm leading-6 text-[var(--color-danger)]"
            role="alert"
          >
            {{ visibleErrors.attachments }}
          </p>

          <div v-if="attachmentNames.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="attachment in attachmentNames"
              :key="attachment"
              class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              {{ attachment }}
            </span>
          </div>
        </div>

        <p
          v-else
          class="mt-5 text-sm leading-6 text-slate-500"
        >
          Nenhum anexo e necessario neste assunto.
        </p>

        <div class="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <button
            type="button"
            :disabled="isSubmitting"
            class="student-focus-ring min-w-0 rounded-[20px] bg-[var(--color-primary)] px-5 py-4 text-center text-sm font-semibold leading-5 text-white shadow-[0_18px_40px_rgba(109,76,255,0.16)] hover:-translate-y-1 disabled:cursor-wait disabled:opacity-75"
            @click="submitProtocol"
          >
            {{ isSubmitting ? 'Enviando solicitacao...' : 'Enviar solicitacao' }}
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="student-focus-ring min-w-0 rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            @click="goBackToFaq"
          >
            Voltar para a orientacao
          </button>
        </div>
      </div>
    </div>

    <template #aside>
      <div v-if="faqContext" class="grid gap-4">
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-for="item in trailItems"
            :key="item.id"
            :to="item.route"
            :class="[
              'student-focus-ring rounded-full border px-3 py-2 text-xs font-semibold transition',
              item.current
                ? 'border-[rgba(109,76,255,0.18)] bg-[rgba(109,76,255,0.08)] text-slate-950'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ]"
            :aria-current="item.current ? 'step' : null"
          >
            {{ item.label }}
          </RouterLink>
        </div>

        <div class="rounded-[18px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Orientacao apresentada</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ faqContext.displayedAnswer }}
          </p>
        </div>

        <div class="rounded-[18px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Assunto sugerido</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ faqContext.finalNode.title }}
          </p>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
