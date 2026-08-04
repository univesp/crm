<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { useStudentSupportStore } from '@/stores/studentSupport'

const router = useRouter()
const studentSupportStore = useStudentSupportStore()
const hasAttemptedSubmit = ref(false)
const isSubmitting = ref(false)
const formMessage = ref('')
const descriptionField = ref(null)
const attachmentField = ref(null)

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
    { id: 'home', label: 'Início', route: '/aluno' },
    { id: 'journey', label: 'Tenho uma dúvida', route: '/aluno/duvida' },
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
  const attachmentList = Array.from(event.target.files || []).map((file) => file.name)
  studentSupportStore.setProtocolAttachments(attachmentList)
}

async function submitProtocol() {
  if (isSubmitting.value) {
    return
  }

  hasAttemptedSubmit.value = true
  formMessage.value = ''
  isSubmitting.value = true
  const result = await studentSupportStore.submitProtocol()

  if (!result.ok) {
    isSubmitting.value = false
    formMessage.value =
      result.validation?.errors?.form || 'Revise os campos destacados antes de enviar sua solicitação.'
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
    eyebrow="Resumo da solicitação"
    title="Continuar com a solicitação"
    description="Revise o resumo abaixo e complemente apenas o que for necessário."
    :mobile-label="faqContext?.finalNode?.title || 'Continuar atendimento'"
    :show-back="true"
    aside-title="Seu caminho"
    @back="goBackToFaq"
  >
    <div
      v-if="!protocolDraft || !faqContext"
      class="max-w-2xl rounded-[8px] border border-slate-200 bg-slate-50/80 p-6"
    >
      <p class="text-sm font-semibold text-slate-900">Solicitação indisponível</p>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Siga a jornada da dúvida até a orientação oficial e escolha continuar atendimento para abrir esta etapa com o contexto preenchido.
      </p>
    </div>

    <div v-else class="grid max-w-2xl gap-4">
      <div class="rounded-[8px] border border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.06)] p-5">
        <p class="text-sm font-semibold text-slate-950">Vamos dar continuidade para você.</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          O portal aproveitou o caminho da sua navegação para sugerir o assunto e reduzir o preenchimento.
        </p>
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-900">Resumo da sua solicitação</p>

        <div class="mt-4 grid gap-3">
          <div class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Tema</p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">{{ protocolDraft.form.theme }}</p>
          </div>

          <div class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Assunto</p>
            <p class="mt-1.5 text-sm font-semibold text-slate-900">{{ protocolDraft.form.subject }}</p>
          </div>

          <div class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Resumo do caminho</p>
            <p class="mt-1.5 text-sm leading-6 text-slate-700">{{ protocolDraft.form.breadcrumb }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <div
          v-if="formMessage"
          class="mb-5 rounded-[8px] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-danger)]"
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
              'student-focus-ring rounded-[8px] border px-4 py-3 text-sm leading-6 text-slate-700',
              visibleErrors.description ? 'border-[var(--color-danger)] bg-[rgba(253,236,237,0.5)]' : 'border-slate-200 bg-white',
            ]"
            :value="protocolDraft.form.description"
            placeholder="Explique o que ainda não foi resolvido."
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
          class="mt-5 rounded-[8px] border border-dashed border-[rgba(209,50,57,0.24)] bg-[rgba(209,50,57,0.04)] p-5"
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
            class="student-focus-ring mt-4 block rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600"
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
          Nenhum anexo é necessário neste assunto.
        </p>

        <div class="crm-split-grid mt-6 gap-3">
          <button
            type="button"
            :disabled="isSubmitting"
            class="student-focus-ring min-w-0 rounded-[8px] bg-[var(--color-primary)] px-5 py-4 text-center text-sm font-semibold leading-5 text-white shadow-sm hover:bg-[var(--color-primary-dark)] disabled:cursor-wait disabled:opacity-75"
            @click="submitProtocol"
          >
            {{ isSubmitting ? 'Enviando solicitação...' : 'Enviar solicitação' }}
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="student-focus-ring min-w-0 rounded-[8px] border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            @click="goBackToFaq"
          >
            Voltar para a orientação
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
                ? 'border-[rgba(209,50,57,0.18)] bg-[rgba(209,50,57,0.08)] text-slate-950'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ]"
            :aria-current="item.current ? 'step' : null"
          >
            {{ item.label }}
          </RouterLink>
        </div>

        <div class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Orientação apresentada</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ faqContext.displayedAnswer }}
          </p>
        </div>

        <div class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Assunto sugerido</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ faqContext.finalNode.title }}
          </p>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
