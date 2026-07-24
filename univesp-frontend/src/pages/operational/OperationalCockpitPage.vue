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
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <header class="crm-page-header mb-0 max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Operação em tempo real</p>
          <h1 class="crm-page-title">Cockpit operacional</h1>
          <p class="crm-page-description">
            Veja SLAs atrasados e em risco no seu escopo, assuma casos críticos e destrave filas sem perder contexto.
          </p>
        </header>

        <RouterLink :to="queueRoute" class="crm-button-secondary shrink-0">
          Abrir fila priorizada
        </RouterLink>
      </div>
    </section>

    <OperationalCockpitPanel :cockpit="cockpit" />
  </div>
</template>
