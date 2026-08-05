<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import OperationalCockpitPanel from '@/components/operational/OperationalCockpitPanel.vue'
import {
  buildOperationalCockpitFromAreaOverview,
  buildOperationalCockpitFromDashboard,
} from '@/services/operationalCockpitRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const router = useRouter()
const isRedirecting = ref(false)

const profileKey = computed(() => auth.mockContext?.profileKey || auth.user?.profileKey || 'admin_central')
const isAreaProfile = computed(() => ['analista_area', 'gestor_area'].includes(profileKey.value))
const isAreaManager = computed(() => profileKey.value === 'gestor_area')

onMounted(() => {
  if (!isAreaManager.value) {
    return
  }

  isRedirecting.value = true
  router.replace('/area/operacao')
})

const pageTitle = computed(() => (isAreaProfile.value ? 'Visão geral da área' : 'Visão geral operacional'))
const pageDescription = computed(() =>
  isAreaProfile.value
    ? 'Acompanhe prazo e criticidade no seu escopo. Para decidir a próxima ação, abra a operação da área.'
    : 'Acompanhe SLAs atrasados e em risco no seu escopo antes de abrir a fila de trabalho.',
)

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

const primaryRoute = computed(() => {
  if (isAreaProfile.value) {
    return '/area/operacao'
  }

  return { path: '/op/fila' }
})

const primaryLabel = computed(() => (isAreaProfile.value ? 'Ir para operação' : 'Abrir fila priorizada'))
</script>

<template>
  <div v-if="isRedirecting" class="crm-panel px-5 py-5" role="status" aria-live="polite">
    Abrindo a Operação da área…
  </div>

  <div v-else class="grid gap-4">
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <header class="crm-page-header mb-0 max-w-3xl">
          <h1 class="crm-page-title">{{ pageTitle }}</h1>
          <p class="crm-page-description">{{ pageDescription }}</p>
        </header>

        <RouterLink :to="primaryRoute" class="crm-button-primary shrink-0">
          {{ primaryLabel }}
        </RouterLink>
      </div>
    </section>

    <OperationalCockpitPanel :cockpit="cockpit" readonly />
  </div>
</template>
