<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import OperationalCockpitPanel from '@/components/operational/OperationalCockpitPanel.vue'
import {
  buildOperationalCockpitFromAreaOverview,
  buildOperationalCockpitFromDashboard,
} from '@/services/operationalCockpitRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const profileKey = computed(() => auth.mockContext?.profileKey || auth.user?.profileKey || 'admin_central')
const isAreaProfile = computed(() => ['analista_area', 'gestor_area'].includes(profileKey.value))

const cockpit = computed(() => {
  if (isAreaProfile.value) {
    const overview = studentSupportStore.areaManagerOverview(auth.mockContext)
    return buildOperationalCockpitFromAreaOverview(overview, profileKey.value, {
      scopeLabel: overview.areaLabel || auth.mockContext?.currentArea || '',
    })
  }

  const dashboardData = studentSupportStore.adminDashboardData(auth.mockContext)
  return buildOperationalCockpitFromDashboard(dashboardData, {}, profileKey.value, {
    scopeLabel: auth.mockContext?.currentPolo || '',
  })
})

const queueRoute = computed(() => {
  if (isAreaProfile.value) {
    return {
      path: '/area/fila',
      query: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
    }
  }

  return { path: '/op/fila' }
})
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Operacao em tempo real</p>
          <h1 class="mt-1 text-xl font-semibold text-slate-950">Cockpit operacional</h1>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Todos os perfis operacionais enxergam o mesmo recorte de risco de SLA para agir rapido,
            assumir casos e destravar filas sem perder contexto.
          </p>
        </div>

        <RouterLink
          :to="queueRoute"
          class="inline-flex items-center rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Abrir fila priorizada
        </RouterLink>
      </div>
    </section>

    <OperationalCockpitPanel :cockpit="cockpit" />
  </div>
</template>
