<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getTicket } from '@/services/appApi'

const route = useRoute()
const router = useRouter()
const state = reactive({ loading: false, error: '', ticket: null })

const protocolId = computed(() => String(route.params.protocolId || '').trim())

function formatDate(value) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

async function loadTicket() {
  if (!protocolId.value) {
    state.error = 'O número do protocolo não foi informado.'
    state.ticket = null
    return
  }

  state.loading = true
  state.error = ''
  try {
    const response = await getTicket(protocolId.value)
    state.ticket = response.data || null
    if (!state.ticket) state.error = 'Protocolo não encontrado ou fora do seu escopo.'
  } catch (error) {
    state.ticket = null
    state.error = error?.message || 'Protocolo não encontrado ou fora do seu escopo.'
  } finally {
    state.loading = false
  }
}

onMounted(loadTicket)
watch(protocolId, loadTicket)
</script>

<template>
  <div class="grid gap-4">
    <section v-if="state.loading" class="rounded-[16px] border border-slate-200 bg-white p-6" role="status">
      Carregando protocolo...
    </section>

    <section v-else-if="state.error" class="rounded-[16px] border border-red-200 bg-red-50 p-5" role="alert">
      <h2 class="text-lg font-semibold text-slate-950">Não foi possível abrir o protocolo</h2>
      <p class="mt-2 text-sm text-slate-700">{{ state.error }}</p>
      <button type="button" class="mt-4 min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 font-semibold" @click="router.push('/admin/dashboard')">
        Voltar à visão geral
      </button>
    </section>

    <template v-else-if="state.ticket">
      <section class="rounded-[16px] border border-slate-200 bg-white p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-500">Protocolo {{ state.ticket.protocol || state.ticket.id }}</p>
            <h2 class="mt-1 break-words text-xl font-semibold text-slate-950">{{ state.ticket.subject || 'Atendimento sem assunto' }}</h2>
            <p class="mt-2 text-sm text-slate-600">{{ state.ticket.description || 'Sem descrição registrada.' }}</p>
          </div>
          <span class="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {{ state.ticket.status_label || state.ticket.status || 'Status não informado' }}
          </span>
        </div>
      </section>

      <div class="grid min-w-0 gap-4 lg:grid-cols-2">
        <section class="min-w-0 rounded-[16px] border border-slate-200 bg-white p-5">
          <h2 class="text-base font-semibold text-slate-950">Aluno</h2>
          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt class="text-slate-500">Nome</dt><dd class="mt-1 break-words font-semibold text-slate-900">{{ state.ticket.student?.name || 'Não informado' }}</dd></div>
            <div><dt class="text-slate-500">RA</dt><dd class="mt-1 font-semibold text-slate-900">{{ state.ticket.student?.ra || 'Não informado' }}</dd></div>
            <div><dt class="text-slate-500">E-mail</dt><dd class="mt-1 break-all font-semibold text-slate-900">{{ state.ticket.student?.email || 'Não informado' }}</dd></div>
            <div><dt class="text-slate-500">Polo</dt><dd class="mt-1 font-semibold text-slate-900">{{ state.ticket.student?.polo || 'Não informado' }}</dd></div>
          </dl>
        </section>

        <section class="min-w-0 rounded-[16px] border border-slate-200 bg-white p-5">
          <h2 class="text-base font-semibold text-slate-950">Encaminhamento</h2>
          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt class="text-slate-500">Fila</dt><dd class="mt-1 break-words font-semibold text-slate-900">{{ state.ticket.queue || 'Não informada' }}</dd></div>
            <div><dt class="text-slate-500">Área</dt><dd class="mt-1 break-words font-semibold text-slate-900">{{ state.ticket.area || 'Não informada' }}</dd></div>
            <div><dt class="text-slate-500">Prioridade</dt><dd class="mt-1 font-semibold text-slate-900">{{ state.ticket.priority || 'Não informada' }}</dd></div>
            <div><dt class="text-slate-500">Atualizado em</dt><dd class="mt-1 font-semibold text-slate-900">{{ formatDate(state.ticket.updated_at || state.ticket.created_at) }}</dd></div>
          </dl>
        </section>
      </div>

      <div>
        <button type="button" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 font-semibold text-slate-800" @click="router.push('/admin/dashboard')">
          Voltar à visão geral
        </button>
      </div>
    </template>
  </div>
</template>