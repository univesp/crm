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
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <header class="crm-page-header mb-0 max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Operação BPO</p>
          <h1 class="crm-page-title">Cockpit operacional</h1>
          <p class="crm-page-description">
            Pool regional: acompanhe SLAs atrasados e em risco para assumir casos críticos quando o polo estiver sob pressão.
          </p>
        </header>

        <RouterLink to="/op/fila" class="crm-button-secondary shrink-0">
          Ir para fila operacional
        </RouterLink>
      </div>

      <div v-if="linkedPolos.length" class="crm-card-muted mt-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Polos no seu escopo</p>
        <p class="mt-2 text-sm text-[var(--color-text)]">{{ linkedPolos.join(' · ') }}</p>
      </div>
      <p v-else class="mt-4 text-sm text-[var(--color-text-muted)]">
        Nenhum polo foi vinculado a este escopo nesta sessão. A fila ficará disponível quando houver casos para acompanhar.
      </p>
    </section>

    <OperationalCockpitPanel :cockpit="cockpit" title="Cockpit BPO" />
  </div>
</template>
