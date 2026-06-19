<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StatusBadge from '@/components/StatusBadge.vue'
import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { buildStudentRequestDetail, STUDENT_REQUEST_STATES } from '@/services/studentPortalRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const studentSupportStore = useStudentSupportStore()
const actionMessage = ref('')
const actionAttachments = ref([])
const actionMessageError = ref('')
const actionAttachmentError = ref('')
const actionFormError = ref('')
const actionSuccess = ref('')
const isSubmittingAction = ref(false)
const actionMessageField = ref(null)
const actionAttachmentField = ref(null)

const detail = computed(() =>
  buildStudentRequestDetail({
    requestId: route.params.protocolId,
    protocolDraft: studentSupportStore.protocolDraft,
    records: studentSupportStore.records,
    protocols: studentSupportStore.protocols,
  }),
)

const trailItems = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    { id: 'home', label: 'Início', route: '/aluno' },
    { id: 'requests', label: 'Minhas solicitações', route: '/aluno/solicitacoes' },
    { id: 'detail', label: detail.value.id, route: route.fullPath, current: true },
  ]
})

const nextStepVariant = computed(() => {
  if (!detail.value) {
    return 'neutral'
  }

  if (detail.value.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED) {
    return 'action'
  }

  if (detail.value.studentState === STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL) {
    return 'info'
  }

  if (detail.value.studentState === STUDENT_REQUEST_STATES.COMPLETED) {
    return 'success'
  }

  return 'neutral'
})
const requiresAttachment = computed(() =>
  Boolean(detail.value?.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED && detail.value?.canUploadDocument),
)

function goBackToRequests() {
  router.push('/aluno/solicitacoes')
}

function handleActionAttachmentChange(event) {
  actionAttachments.value = Array.from(event.target.files || []).map((file) => file.name)
  actionAttachmentError.value = ''
  actionFormError.value = ''
}

function handleActionMessageInput(event) {
  actionMessage.value = event.target.value
  actionMessageError.value = ''
  actionFormError.value = ''
}

function submitPendingAction() {
  if (!detail.value || detail.value.studentState !== STUDENT_REQUEST_STATES.ACTION_REQUIRED || isSubmittingAction.value) {
    return
  }

  actionMessageError.value = ''
  actionAttachmentError.value = ''
  actionFormError.value = ''
  actionSuccess.value = ''

  if (requiresAttachment.value && !actionAttachments.value.length) {
    actionAttachmentError.value = 'Envie o documento solicitado para continuar o atendimento.'
    nextTick(() => actionAttachmentField.value?.focus())
    return
  }

  if (!actionMessage.value.trim() && !actionAttachments.value.length) {
    actionMessageError.value = 'Escreva uma resposta breve ou envie o documento solicitado.'
    nextTick(() => actionMessageField.value?.focus())
    return
  }

  isSubmittingAction.value = true
  const updatedProtocol = studentSupportStore.submitRequestFollowUp({
    requestId: detail.value.id,
    note: actionMessage.value,
    attachments: actionAttachments.value,
  })
  isSubmittingAction.value = false

  if (!updatedProtocol) {
    actionFormError.value = 'Não foi possível registrar sua resposta agora. Tente novamente.'
    return
  }

  actionMessage.value = ''
  actionAttachments.value = []
  actionSuccess.value = requiresAttachment.value
    ? 'Documento enviado. Agora a equipe retoma a análise.'
    : 'Resposta registrada. Agora a equipe retoma a análise.'
}
</script>

<template>
  <StudentStageLayout
    eyebrow="Registro"
    title="Detalhe da solicitação"
    description="Veja o status, o próximo passo e o histórico deste atendimento."
    :mobile-label="detail?.id || 'Detalhe da solicitação'"
    :show-back="true"
    aside-title="Seu caminho"
    @back="goBackToRequests"
  >
    <div
      v-if="!detail"
      class="max-w-2xl rounded-[8px] border border-slate-200 bg-slate-50/80 p-6"
      role="status"
      aria-live="polite"
    >
      <p class="text-sm font-semibold text-slate-900">Detalhe indisponível</p>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Não encontramos esse registro no portal local. Volte para Minhas solicitações para seguir.
      </p>
      <RouterLink
        to="/aluno/solicitacoes"
        class="student-focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Voltar para Minhas solicitações
      </RouterLink>
    </div>

    <div v-else class="grid max-w-2xl gap-4">
      <div
        v-if="actionSuccess"
        class="rounded-[8px] border border-[rgba(26,111,67,0.18)] bg-[rgba(26,111,67,0.08)] px-5 py-4 text-sm leading-6 text-[var(--color-success)]"
        role="status"
        aria-live="polite"
      >
        {{ actionSuccess }}
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="student-section-label">Registro</p>
            <h2 class="mt-2 text-[1.6rem] font-semibold leading-tight text-slate-950">
              {{ detail.subject }}
            </h2>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              Atualizado em {{ detail.updatedAtLabel }}.
            </p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              {{ detail.id }}
            </p>
          </div>
          <StatusBadge :label="detail.statusLabel" />
        </div>
      </div>

      <div
        :class="[
          'rounded-[8px] border p-5',
          nextStepVariant === 'action'
            ? 'border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.06)]'
            : nextStepVariant === 'info'
              ? 'border-[rgba(0,95,153,0.16)] bg-[rgba(0,95,153,0.06)]'
              : nextStepVariant === 'success'
                ? 'border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.06)]'
                : 'border-slate-200 bg-slate-50/80',
        ]"
      >
        <p class="student-section-label">Proximo passo</p>
        <h3 class="mt-3 text-lg font-semibold text-slate-950">
          {{ detail.nextStepTitle }}
        </h3>
        <p class="mt-3 text-sm leading-7 text-slate-700">
          {{ detail.nextStepDescription }}
        </p>
        <p
          class="mt-4 text-sm font-semibold"
          :class="detail.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED ? 'text-[var(--color-danger)]' : 'text-slate-700'"
        >
          {{
            detail.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED
              ? detail.actionDescription
              : 'Nenhuma ação sua e necessaria neste momento.'
          }}
        </p>

        <div
          v-if="detail.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED"
          class="mt-5 rounded-[8px] border border-[rgba(209,50,57,0.18)] bg-white p-4"
        >
          <p class="text-sm font-semibold text-slate-900">
            {{ detail.actionLabel || 'Sua ação e necessaria' }}
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Envie a informação pendente por aqui para o atendimento continuar.
          </p>

          <label class="mt-4 grid gap-2">
            <span class="text-sm font-semibold text-slate-900">Mensagem complementar</span>
            <textarea
              ref="actionMessageField"
              :value="actionMessage"
              rows="4"
              class="student-focus-ring rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
              :aria-invalid="actionMessageError ? 'true' : 'false'"
              :aria-describedby="actionMessageError ? 'student-detail-action-message-help student-detail-action-message-error' : 'student-detail-action-message-help'"
              placeholder="Explique brevemente o que está enviando para esta solicitação."
              @input="handleActionMessageInput"
            />
          </label>
          <p id="student-detail-action-message-help" class="mt-2 text-sm leading-6 text-slate-600">
            Use este campo para complementar sua resposta quando necessário.
          </p>
          <p
            v-if="actionMessageError"
            id="student-detail-action-message-error"
            class="mt-3 text-sm leading-6 text-[var(--color-danger)]"
            role="alert"
          >
            {{ actionMessageError }}
          </p>

          <div class="mt-4 grid gap-2">
            <label
              for="student-detail-action-attachment-input"
              class="text-sm font-semibold text-slate-900"
            >
              {{ requiresAttachment ? 'Documento solicitado' : 'Anexar documento (opcional)' }}
            </label>
            <input
              id="student-detail-action-attachment-input"
              ref="actionAttachmentField"
              type="file"
              multiple
              class="student-focus-ring rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600"
              :aria-invalid="actionAttachmentError ? 'true' : 'false'"
              :aria-describedby="actionAttachmentError ? 'student-detail-action-attachment-help student-detail-action-attachment-error' : 'student-detail-action-attachment-help'"
              @change="handleActionAttachmentChange"
            />
            <p id="student-detail-action-attachment-help" class="text-sm leading-6 text-slate-600">
              {{ requiresAttachment ? 'Envie o documento solicitado para esta pendencia.' : 'Se quiser, você pode anexar um documento para complementar a resposta.' }}
            </p>
          </div>

          <div v-if="actionAttachments.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="attachment in actionAttachments"
              :key="attachment"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {{ attachment }}
            </span>
          </div>

          <p
            v-if="actionAttachmentError"
            id="student-detail-action-attachment-error"
            class="mt-4 text-sm leading-6 text-[var(--color-danger)]"
            role="alert"
          >
            {{ actionAttachmentError }}
          </p>

          <p
            v-if="actionFormError"
            class="mt-4 text-sm leading-6 text-[var(--color-danger)]"
            role="alert"
          >
            {{ actionFormError }}
          </p>

          <button
            type="button"
            :disabled="isSubmittingAction"
            class="student-focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-danger)] px-5 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-75"
            @click="submitPendingAction"
          >
            {{ isSubmittingAction ? 'Enviando...' : requiresAttachment ? 'Enviar documento' : 'Enviar resposta' }}
          </button>
        </div>
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-900">Resumo</p>
        <p class="mt-3 text-sm leading-7 text-slate-700">
          {{ detail.summary }}
        </p>
      </div>

      <div class="rounded-[8px] border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-900">Linha do tempo</p>

        <div class="mt-4 grid gap-3">
          <article
            v-for="item in detail.timeline"
            :key="item.id"
            class="rounded-[8px] border border-slate-200 bg-slate-50/80 p-4"
          >
            <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
              </div>
              <span class="student-section-label whitespace-nowrap">{{ item.atLabel }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>

    <template #aside>
      <div v-if="detail" class="grid gap-4">
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-for="item in trailItems"
            :key="item.id"
            :to="item.route"
            :class="[
              'student-focus-ring rounded-full border px-3 py-2 text-xs font-semibold',
              item.current
                ? 'border-[rgba(209,50,57,0.18)] bg-[rgba(209,50,57,0.08)] text-slate-950'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ]"
            :aria-current="item.current ? 'page' : null"
          >
            {{ item.label }}
          </RouterLink>
        </div>

        <div class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Status atual</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ detail.statusLabel }}</p>
        </div>

        <div
          v-if="detail.contextTrail.length"
          class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4"
        >
          <p class="text-sm font-semibold text-slate-900">Caminho seguido</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ detail.contextTrail.join(' > ') }}
          </p>
        </div>

        <div class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4">
          <p class="text-sm font-semibold text-slate-900">Anexos</p>
          <p
            v-if="detail.attachments.length"
            class="mt-2 text-sm leading-6 text-slate-600"
          >
            {{ detail.attachments.map((attachment) => attachment.name).join(', ') }}
          </p>
          <p
            v-else
            class="mt-2 text-sm leading-6 text-slate-600"
          >
            Nenhum anexo enviado ate agora.
          </p>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
