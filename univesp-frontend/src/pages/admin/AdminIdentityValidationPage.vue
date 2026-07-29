<script setup>
import { onMounted, ref } from 'vue'

import AsyncPanel from '@/components/ui/AsyncPanel.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { decideIdentityValidation, listIdentityValidations } from '@/services/appApi'

const { loading, error, run } = useAsyncAction()
const rows = ref([])
const notes = ref({})
const filter = ref('pending')

async function load() {
  await run(async () => {
    const response = await listIdentityValidations({ state: filter.value })
    rows.value = Array.isArray(response.data) ? response.data : []
  }, { errorFallback: 'Não foi possível carregar a fila de validação.' })
}

async function decide(row, decision) {
  const justification = String(notes.value[row.name] || '').trim()
  if (justification.length < 10) return
  await run(async () => {
    await decideIdentityValidation(row.name, { decision, notes: justification })
    await load()
  }, { errorFallback: 'Não foi possível registrar a decisão.' })
}

onMounted(load)
</script>

<template>
  <div class="grid gap-5">
    <section class="surface-panel p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Atendimento sem SSO</p>
      <h2 class="mt-2 text-xl font-semibold text-slate-950">Validação de vínculo</h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Trate apenas resultados inconclusivos. Os dados exibidos permanecem mascarados e cada decisão
        registra responsável, horário e justificativa.
      </p>
    </section>

    <section class="inner-panel p-5">
      <label class="grid max-w-xs gap-1 text-sm">
        <span class="font-semibold text-slate-700">Situação</span>
        <select v-model="filter" class="rounded-ui border border-slate-200 px-3 py-2" @change="load">
          <option value="pending">Pendentes</option>
          <option value="verified">Confirmadas</option>
          <option value="rejected">Recusadas</option>
          <option value="all">Todas</option>
        </select>
      </label>
    </section>

    <AsyncPanel :loading="loading" :error="error" :empty="!rows.length" empty-message="Nenhuma validação nesta situação.">
      <ul class="grid gap-4">
        <li v-for="row in rows" :key="row.name" class="surface-panel p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-950">{{ row.person }}</p>
              <p class="mt-1 text-sm text-slate-600">
                {{ row.protocol }} · {{ row.email_masked }} · {{ row.phone_masked }}
              </p>
              <p class="mt-1 text-xs text-slate-500">
                Resultado automático: {{ row.outcome }} · SLA: {{ row.sla_due_at }}
              </p>
            </div>
            <span
              :class="[
                'rounded-full px-3 py-1 text-xs font-semibold',
                row.overdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
              ]"
            >
              {{ row.overdue ? 'SLA vencido' : row.state }}
            </span>
          </div>
          <p class="mt-3 text-sm text-slate-600">
            RA {{ row.academic_context?.ra || 'não informado' }} ·
            Curso {{ row.academic_context?.course || 'não informado' }} ·
            Polo {{ row.academic_context?.pole || 'não informado' }}
          </p>
          <div v-if="row.state === 'pending'" class="mt-4 grid gap-3">
            <label class="grid gap-1 text-sm">
              <span class="font-semibold text-slate-700">Justificativa da decisão</span>
              <textarea
                v-model="notes[row.name]"
                rows="3"
                class="rounded-ui border border-slate-200 px-3 py-2"
                placeholder="Registre como o vínculo foi confirmado ou por que foi recusado."
              />
            </label>
            <div class="flex flex-wrap gap-2">
              <SgpButton
                type="button"
                :disabled="String(notes[row.name] || '').trim().length < 10"
                @click="decide(row, 'verified')"
              >
                Confirmar vínculo
              </SgpButton>
              <SgpButton
                type="button"
                variant="secondary"
                :disabled="String(notes[row.name] || '').trim().length < 10"
                @click="decide(row, 'rejected')"
              >
                Recusar vínculo
              </SgpButton>
            </div>
          </div>
        </li>
      </ul>
    </AsyncPanel>
  </div>
</template>
