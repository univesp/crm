<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import OperationalCockpitPanel from '@/components/operational/OperationalCockpitPanel.vue'
import { buildOperationalCockpitFromDashboard } from '@/services/operationalCockpitRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const linkedPolos = computed(() => auth.mockContext?.linkedPolos || [])
const profileLabel = computed(() => auth.user?.profileKey || 'op_externo')
const cockpit = computed(() =>
  buildOperationalCockpitFromDashboard(
    studentSupportStore.adminDashboardData(auth.mockContext),
    {},
    profileLabel.value,
    {
      scopeLabel: linkedPolos.value.length
        ? `${linkedPolos.value.length} polo(s) no pool`
        : 'Pool regional',
    },
  ),
)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Operacao BPO</p>
          <h1 class="mt-1 text-xl font-semibold text-slate-950">Cockpit operacional</h1>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Operadores externos (<code>{{ profileLabel }}</code>) enxergam SLAs atrasados e em risco no pool
            regional para assumir casos e acelerar a fila quando necessario.
          </p>
        </div>

        <RouterLink
          to="/op/fila"
          class="inline-flex items-center rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Ir para fila operacional
        </RouterLink>
      </div>

      <div v-if="linkedPolos.length" class="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Polos no seu pool</p>
        <p class="mt-2 text-sm text-slate-700">{{ linkedPolos.join(' · ') }}</p>
      </div>
      <p v-else class="mt-4 text-sm text-slate-600">
        Nenhum polo vinculado nesta sessao. Em producao, o escopo vem do perfil Frappe
        (<code>regional_pools</code>).
      </p>
    </section>

    <OperationalCockpitPanel :cockpit="cockpit" title="Cockpit BPO" />
  </div>
</template>
