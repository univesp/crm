<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const studentSupportStore = useStudentSupportStore()
const operatorNote = ref('')

const detail = computed(() => studentSupportStore.operatorCaseById(route.params.caseId))

function goBackToQueue() {
  router.push('/op/fila')
}

function goToPlaybook() {
  router.push('/op/playbook')
}

function runOperatorAction(actionType) {
  if (!detail.value) {
    return
  }

  studentSupportStore.registerOperatorAction({
    caseId: detail.value.id,
    actionType,
    note: operatorNote.value,
    playbook: detail.value.playbook,
  })

  operatorNote.value = ''
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="OP"
      title="Detalhe operacional do atendimento"
      description="Leitura rapida do caso, apoio do playbook operacional e registro local das acoes do OP."
    >
      <template #action>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goBackToQueue"
          >
            Voltar para fila
          </button>
          <button
            type="button"
            class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            @click="goToPlaybook"
          >
            Ver FAQ operacional
          </button>
        </div>
      </template>

      <div v-if="!detail" class="inner-panel p-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Atendimento indisponivel
        </p>
        <h3 class="mt-3 text-2xl font-semibold text-slate-950">
          O caso informado nao foi encontrado na base operacional mockada.
        </h3>
        <p class="mt-3 text-sm leading-7 text-slate-600">
          Volte para a fila do OP e abra um atendimento existente para visualizar o detalhe.
        </p>
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {{ detail.id }}
                  </p>
                  <span class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]">
                    {{ detail.sourceLabel }}
                  </span>
                </div>
                <h3 class="mt-3 text-2xl font-semibold text-slate-950">{{ detail.subject }}</h3>
                <p class="mt-3 text-sm leading-7 text-slate-600">
                  {{ detail.theme }} · {{ detail.subsubject }} · Polo {{ detail.polo }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="detail.priority" />
                <StatusBadge :label="detail.criticality" />
                <StatusBadge :label="detail.status" />
                <SlaBadge :label="detail.sla" />
              </div>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-4">
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fila</p>
                <p class="mt-2 font-semibold text-slate-900">{{ detail.queue }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Aluno</p>
                <p class="mt-2 font-semibold text-slate-900">{{ detail.studentData.nome }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">RA</p>
                <p class="mt-2 font-semibold text-slate-900">{{ detail.studentData.ra || 'Nao informado' }}</p>
              </div>
              <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Data/hora</p>
                <p class="mt-2 font-semibold text-slate-900">{{ detail.activityAtLabel }}</p>
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Contexto herdado da FAQ do aluno
            </p>
            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.faqContext.theme }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subtema</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.faqContext.subtheme || 'Nao informado' }}</p>
              </div>
              <div class="md:col-span-2">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Breadcrumb</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">{{ detail.faqContext.breadcrumb.join(' > ') }}</p>
              </div>
              <div class="md:col-span-2">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">No final</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.faqContext.finalNode.title }}</p>
              </div>
              <div class="md:col-span-2">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta final que levou ao protocolo</p>
                <p class="mt-2 text-sm leading-7 text-slate-700">{{ detail.faqAnswer }}</p>
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Timeline do atendimento
            </p>
            <div class="mt-5 grid gap-4">
              <article
                v-for="item in detail.timeline"
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
                v-for="interaction in detail.interactions"
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

          <div class="inner-panel p-6">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Historico correlato do aluno
                </p>
                <h3 class="mt-3 text-xl font-semibold text-slate-950">
                  Reincidencia e contexto recente
                </h3>
                <p class="mt-3 text-sm leading-7 text-slate-600">
                  {{ detail.correlatedHistory.summary.recurrenceLabel }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-if="detail.correlatedHistory.signals.repeatedTheme"
                  class="rounded-full bg-[rgba(252,233,235,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]"
                >
                  Tema reincidente
                </span>
                <span
                  v-if="detail.correlatedHistory.signals.repeatedSubsubject"
                  class="rounded-full bg-[rgba(255,244,218,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-warning)]"
                >
                  Subtema reincidente
                </span>
                <span
                  v-if="detail.correlatedHistory.signals.priorSelfServiceRelated"
                  class="rounded-full bg-[rgba(228,247,236,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-success)]"
                >
                  FAQ relacionada ja resolveu caso anterior
                </span>
              </div>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-3">
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atendimentos anteriores</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.total }}</p>
              </div>
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Autoatendimentos FAQ</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.previousFaqResolvedCount }}</p>
              </div>
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Protocolos enviados</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.previousProtocolsCount }}</p>
              </div>
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mesmo tema</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.sameThemeCount }}</p>
              </div>
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mesmo subtema</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.sameSubsubjectCount }}</p>
              </div>
              <div class="rounded-[20px] bg-slate-50 px-4 py-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Janela recente</p>
                <p class="mt-2 text-2xl font-semibold text-slate-950">{{ detail.correlatedHistory.summary.recentWindowCount }}</p>
              </div>
            </div>

            <div v-if="detail.correlatedHistory.items.length" class="mt-5 grid gap-3">
              <article
                v-for="item in detail.correlatedHistory.items"
                :key="item.id"
                class="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {{ item.createdAtLabel }}
                    </p>
                    <h4 class="mt-2 text-lg font-semibold text-slate-950">{{ item.subject }}</h4>
                    <p class="mt-2 text-sm leading-6 text-slate-600">
                      {{ item.theme }} · {{ item.subsubject }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <StatusBadge :label="item.status" />
                    <span
                      v-if="item.sameTheme"
                      class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                    >
                      Mesmo tema
                    </span>
                    <span
                      v-if="item.sameSubsubject"
                      class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                    >
                      Mesmo subtema
                    </span>
                    <span
                      v-if="item.previousSelfService"
                      class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                    >
                      Autoatendimento
                    </span>
                    <span
                      v-if="item.recent"
                      class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                    >
                      Janela recente
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <p v-else class="mt-5 text-sm leading-7 text-slate-600">
              Nao ha historico correlato adicional para este aluno na base mockada.
            </p>
          </div>
        </div>

        <div class="grid gap-4">
          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Dados do aluno
            </p>
            <div class="mt-5 grid gap-4">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nome</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.studentData.nome }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">RA</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.studentData.ra || 'Nao informado' }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Curso</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.studentData.curso || 'Nao informado' }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">E-mail</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ detail.studentData.email || 'Nao informado' }}</p>
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              FAQ operacional / playbook
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">
              {{ detail.playbook.title }}
            </h3>

            <div class="mt-5 grid gap-4">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist OP</p>
                <div class="mt-3 grid gap-2">
                  <div
                    v-for="item in detail.playbook.checklist"
                    :key="item"
                    class="rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    {{ item }}
                  </div>
                  <p v-if="!detail.playbook.checklist.length" class="text-sm leading-6 text-slate-600">
                    Nenhum checklist especifico para este caso na base mockada.
                  </p>
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sistemas a consultar</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="item in detail.playbook.systemsToCheck"
                    :key="item"
                    class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                  >
                    {{ item }}
                  </span>
                  <span
                    v-if="!detail.playbook.systemsToCheck.length"
                    class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                  >
                    Nenhum sistema listado
                  </span>
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Documentos a solicitar</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="item in detail.playbook.documentsRequested"
                    :key="item"
                    class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                  >
                    {{ item }}
                  </span>
                  <span
                    v-if="!detail.playbook.documentsRequested.length"
                    class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
                  >
                    Nenhum documento adicional
                  </span>
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta padrao sugerida</p>
                <p class="mt-2 text-sm leading-7 text-slate-700">
                  {{ detail.playbook.responseTemplate || 'Sem resposta padrao definida para este playbook.' }}
                </p>
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Criterio de escalonamento</p>
                <p class="mt-2 text-sm leading-7 text-slate-700">
                  {{ detail.playbook.escalationCriteria || 'Aplicar triagem operacional antes de escalar.' }}
                </p>
              </div>

              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Motivo de escalonamento sugerido</p>
                <p class="mt-2 text-sm leading-7 text-slate-700">
                  {{ detail.playbook.escalationReason || 'Sem motivo sugerido na base mockada.' }}
                </p>
              </div>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Acoes do OP
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">
              Registrar a proxima acao operacional
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">
              Se voce nao preencher observacao, o sistema usa a resposta ou a regra sugerida pelo playbook.
            </p>

            <label class="mt-5 grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Observacao operacional</span>
              <textarea
                v-model="operatorNote"
                rows="5"
                class="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                placeholder="Registre a orientacao, a complementacao solicitada ou o motivo do escalonamento."
              />
            </label>

            <div class="mt-5 grid gap-3">
              <button
                type="button"
                class="rounded-[20px] bg-[var(--color-primary)] px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(209,50,57,0.18)]"
                @click="runOperatorAction('reply')"
              >
                Responder ao aluno
              </button>
              <button
                type="button"
                class="rounded-[20px] border border-[var(--color-warning)] bg-[rgba(255,244,218,0.7)] px-5 py-4 text-sm font-semibold text-[var(--color-warning)]"
                @click="runOperatorAction('request_info')"
              >
                Solicitar complementacao
              </button>
              <button
                type="button"
                class="rounded-[20px] border border-[var(--color-danger)] bg-[rgba(253,236,237,0.75)] px-5 py-4 text-sm font-semibold text-[var(--color-danger)]"
                @click="runOperatorAction('escalate')"
              >
                Escalar para area interna
              </button>
            </div>
          </div>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Anexos
            </p>
            <div v-if="detail.attachments.length" class="mt-5 grid gap-3">
              <div
                v-for="attachment in detail.attachments"
                :key="attachment.id"
                class="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <p class="text-sm font-semibold text-slate-900">{{ attachment.name }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ attachment.status }}</p>
              </div>
            </div>
            <p v-else class="mt-4 text-sm leading-7 text-slate-600">
              Nenhum anexo registrado neste atendimento mockado.
            </p>
          </div>
        </div>
      </div>
    </SectionPanel>
  </div>
</template>
