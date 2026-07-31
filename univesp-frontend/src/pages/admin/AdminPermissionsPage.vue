<script setup>
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FaqKnowledgeGrantsPanel from '@/components/admin/faq-v3/FaqKnowledgeGrantsPanel.vue'
import MetricCard from '@/components/MetricCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFaqKnowledgeGrants } from '@/composables/useFaqKnowledgeGrants'
import {
  approveAccessRequest,
  getAdminCatalogs,
  getAdminUser,
  getKnowledgeV3Catalogs,
  isMockRuntimeEnabled,
  listAccessRequests,
  listAdminUsers,
  updateAdminUser,
} from '@/services/appApi'
import { useAuthStore } from '@/stores/auth'
import {
  applyPermissionEntryUpdate,
  buildAdminPermissionsRuntime,
  buildPermissionForm,
  cloneAdminPermissionsDraft,
  findPermissionEntry,
} from '@/services/adminPermissionsRuntime'
import { KNOWLEDGE_ACTION_CATALOG } from '@/services/knowledgePermissionsRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const {
  loading: grantsLoading,
  saving: grantsSaving,
  errorMessage: grantsErrorMessage,
  successMessage: grantsSuccessMessage,
  grantForm,
  grantSubjects,
  eligibleGrantProfiles,
  contributorAssignments,
  loadGrantCatalogs,
  onGrantSubjectChange,
  grantSuggestionAccess,
  revokeSuggestionAccess,
  prefillTheme,
} = useFaqKnowledgeGrants()
const knowledgeThemes = ref([])
const knowledgeThemeFilter = ref('')
const knowledgeActionCatalog = Object.values(KNOWLEDGE_ACTION_CATALOG)
const studentSupportStore = useStudentSupportStore()
const liveUsers = ref([])
const liveAccessRequests = ref([])
const liveCatalogs = ref({ profiles: [], queues: [], polos: [], areas: [] })
const livePanel = reactive({
  loading: false,
  error: '',
  mode: 'users',
  selectedUser: null,
  selectedRequest: null,
  userActive: true,
  userReason: '',
  approvalProfile: '',
  approvalQueues: [],
  approvalScopes: {
    queues: [],
    polos: [],
    areas: [],
    regional_pools: [],
  },
  approvalReason: '',
})

const SCOPE_DIMENSION_LABELS = {
  queues: 'Filas',
  polos: 'Polos',
  areas: 'Areas',
  regional_pools: 'Regioes',
}

const selectedApprovalProfile = computed(() =>
  liveCatalogs.value.profiles.find((entry) => entry.key === livePanel.approvalProfile) || null,
)

const approvalScopeDimensions = computed(() => {
  const profile = selectedApprovalProfile.value
  const keys = profile?.scope_keys?.length
    ? profile.scope_keys
    : profile?.scope_key
      ? [profile.scope_key]
      : []
  return keys.filter(Boolean)
})

const approvalScopeSummary = computed(() => {
  const parts = approvalScopeDimensions.value
    .map((dimension) => {
      const values = livePanel.approvalScopes[dimension] || []
      if (!values.length) return ''
      const catalog = scopeCatalogFor(dimension)
      const labels = values.map(
        (value) => catalog.find((entry) => entry.value === value)?.label || value,
      )
      return `${SCOPE_DIMENSION_LABELS[dimension] || dimension}: ${labels.join(', ')}`
    })
    .filter(Boolean)
  if (!parts.length) {
    return 'Selecione ao menos uma dimensao de escopo para este perfil.'
  }
  return `Efeito combinado (intersecao): ${parts.join(' · ')}`
})

function scopeCatalogFor(dimension) {
  if (dimension === 'queues') return liveCatalogs.value.queues || []
  if (dimension === 'polos') return liveCatalogs.value.polos || []
  if (dimension === 'areas') return liveCatalogs.value.areas || []
  return liveCatalogs.value.regional_pools || liveCatalogs.value.regions || []
}

function resetApprovalScopes() {
  livePanel.approvalScopes = {
    queues: [],
    polos: [],
    areas: [],
    regional_pools: [],
  }
}

function buildApprovalScopes() {
  const scopes = {}
  for (const dimension of approvalScopeDimensions.value) {
    const values = (livePanel.approvalScopes[dimension] || []).filter(Boolean)
    if (values.length) {
      scopes[dimension] = [...values]
    }
  }
  return scopes
}

async function loadInstitutionalAccess() {
  if (isMockRuntimeEnabled()) return
  livePanel.loading = true
  livePanel.error = ''
  try {
    const [catalogs, users, requests] = await Promise.all([
      getAdminCatalogs(),
      listAdminUsers({ page: 1, page_size: 25 }),
      listAccessRequests({ page: 1, page_size: 25, status: 'pending' }),
    ])
    liveCatalogs.value = catalogs.data || liveCatalogs.value
    liveUsers.value = Array.isArray(users.data) ? users.data : []
    liveAccessRequests.value = Array.isArray(requests.data) ? requests.data : []
  } catch (error) {
    livePanel.error = error?.message || 'Não foi possível carregar pessoas e solicitações.'
  } finally {
    livePanel.loading = false
  }
}

async function openLiveUser(user) {
  livePanel.error = ''
  try {
    const result = await getAdminUser(user.email || user.id)
    livePanel.selectedUser = result.data || user
    livePanel.userActive = Boolean(livePanel.selectedUser.active)
    livePanel.userReason = ''
  } catch (error) {
    livePanel.error = error?.message || 'Não foi possível carregar o usuário.'
  }
}

async function saveLiveUser() {
  const user = livePanel.selectedUser
  if (!user) return
  try {
    const result = await updateAdminUser(user.email || user.id, {
      active: livePanel.userActive,
      version: user.version,
      reason: livePanel.userReason.trim(),
    })
    livePanel.selectedUser = result.data || { ...user, active: livePanel.userActive }
    liveUsers.value = liveUsers.value.map((entry) =>
      entry.id === user.id ? livePanel.selectedUser : entry,
    )
  } catch (error) {
    livePanel.error = error?.message || 'Não foi possível salvar o usuário.'
  }
}

function openLiveRequest(request) {
  livePanel.selectedRequest = request
  livePanel.approvalProfile = ''
  livePanel.approvalQueues = []
  resetApprovalScopes()
  livePanel.approvalReason = ''
}

async function approveLiveRequest() {
  const request = livePanel.selectedRequest
  if (!request) return
  const scopes = buildApprovalScopes()
  try {
    await approveAccessRequest(request.id, {
      profile_key: livePanel.approvalProfile,
      scopes,
      reason: livePanel.approvalReason.trim(),
    })
    liveAccessRequests.value = liveAccessRequests.value.filter((entry) => entry.id !== request.id)
    livePanel.selectedRequest = null
  } catch (error) {
    livePanel.error = error?.message || 'Não foi possível aprovar a solicitação.'
  }
}

onMounted(async () => {
  void loadInstitutionalAccess()
  if (route.query.tab === 'knowledge') {
    ui.activeModule = 'knowledge'
    knowledgeThemeFilter.value = String(route.query.theme || '')
    await loadKnowledgeTab()
  }
})

async function loadKnowledgeTab() {
  try {
    const catalogResponse = await getKnowledgeV3Catalogs()
    knowledgeThemes.value = catalogResponse.data?.themes || []
    await loadGrantCatalogs(knowledgeThemes.value)
    if (knowledgeThemeFilter.value) {
      prefillTheme(knowledgeThemeFilter.value)
    }
  } catch {
    knowledgeThemes.value = []
  }
}

function setActiveModule(module) {
  ui.activeModule = module
  if (module === 'profiles') ui.profileDetailOpen = false
  if (module === 'users') ui.userDetailOpen = false
  if (module === 'knowledge') void loadKnowledgeTab()
  syncPermissionsQuery()
}

function syncPermissionsQuery() {
  const query = { ...route.query }
  if (ui.activeModule === 'knowledge') {
    query.tab = 'knowledge'
    query.context = 'faq-suggestions'
    if (knowledgeThemeFilter.value) query.theme = knowledgeThemeFilter.value
    else delete query.theme
  } else {
    delete query.tab
    delete query.theme
    delete query.context
  }
  router.replace({ query })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'knowledge' && ui.activeModule !== 'knowledge') {
      ui.activeModule = 'knowledge'
      knowledgeThemeFilter.value = String(route.query.theme || '')
      void loadKnowledgeTab()
    }
  },
)

watch(knowledgeThemeFilter, () => {
  if (ui.activeModule === 'knowledge') syncPermissionsQuery()
})
const permissionsDraft = reactive(cloneAdminPermissionsDraft())
const form = reactive({
  id: '',
  profileKey: '',
  scopeType: 'fila',
  scopeValues: [],
  allowedActions: {},
  note: '',
})
const ui = reactive({
  selectedEntryId: null,
  lastAuditMessage: '',
  activeModule: 'profiles',
  profileDetailOpen: false,
  profileDetailTab: 'summary',
  selectedUserId: 'demo-ana',
  userDetailOpen: false,
  userDetailTab: 'summary',
  userSearch: '',
  userProfileFilter: '',
  userScopeFilter: '',
  userStatusFilter: '',
})

const demoPermissionUsers = Object.freeze([
  {
    id: 'demo-ana',
    name: 'Ana Exemplo',
    email: 'ana.exemplo@exemplo.local',
    profileKey: 'admin_central',
    profileLabel: 'Admin central',
    scopeLabel: 'Global',
    scopeKeys: ['status:ativo'],
    status: 'ativo',
    critical: true,
    activity: 'Publicacao e auditoria',
    handledCases: 12,
    avgSla: '1d 4h',
    reassignments: 3,
  },
  {
    id: 'demo-bruno',
    name: 'Bruno Exemplo',
    email: 'bruno.exemplo@exemplo.local',
    profileKey: 'gestor_area',
    profileLabel: 'Gestor de area',
    scopeLabel: 'Secretaria Academica',
    scopeKeys: ['area:secretaria_academica', 'queue:Secretaria Academica', 'status:ativo'],
    status: 'ativo',
    critical: true,
    activity: 'Reatribuicao e auditoria',
    handledCases: 38,
    avgSla: '18h',
    reassignments: 7,
  },
  {
    id: 'demo-carla',
    name: 'Carla Exemplo',
    email: 'carla.exemplo@exemplo.local',
    profileKey: 'analista_area',
    profileLabel: 'Analista de area',
    scopeLabel: 'Suporte Academico Digital',
    scopeKeys: ['area:suporte_academico_digital', 'queue:Suporte Academico Digital', 'status:ativo'],
    status: 'ativo',
    critical: false,
    activity: 'Resposta de casos',
    handledCases: 64,
    avgSla: '9h',
    reassignments: 1,
  },
  {
    id: 'demo-diego',
    name: 'Diego Exemplo',
    email: 'diego.exemplo@exemplo.local',
    profileKey: 'op',
    profileLabel: 'OP',
    scopeLabel: 'Polo Guarulhos',
    scopeKeys: ['polo:Guarulhos', 'status:ativo'],
    status: 'ativo',
    critical: false,
    activity: 'Atendimento do polo',
    handledCases: 41,
    avgSla: '11h',
    reassignments: 2,
  },
  {
    id: 'demo-elena',
    name: 'Elena Exemplo',
    email: 'elena.exemplo@exemplo.local',
    profileKey: 'gestor_polos',
    profileLabel: 'Gestor de polos',
    scopeLabel: 'Guarulhos, Campinas e Sao Jose dos Campos',
    scopeKeys: ['polo:Guarulhos', 'polo:Campinas', 'polo:Sao Jose dos Campos', 'status:ativo'],
    status: 'ativo',
    critical: true,
    activity: 'Gestao de polos',
    handledCases: 29,
    avgSla: '16h',
    reassignments: 8,
  },
  {
    id: 'demo-felipe',
    name: 'Felipe Exemplo',
    email: 'felipe.exemplo@exemplo.local',
    profileKey: 'analista_area',
    profileLabel: 'Analista de area',
    scopeLabel: 'Financeiro',
    scopeKeys: ['area:financeiro', 'queue:Financeiro', 'status:inativo'],
    status: 'inativo',
    critical: false,
    activity: 'Sem atividade recente',
    handledCases: 4,
    avgSla: '2d',
    reassignments: 0,
  },
])

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const runtime = computed(() =>
  buildAdminPermissionsRuntime({
    dashboardData: dashboardData.value,
    draft: permissionsDraft,
  }),
)
const selectedEntry = computed(() => findPermissionEntry(permissionsDraft.matrix, ui.selectedEntryId))
const selectedRuntimeEntry = computed(
  () => runtime.value.matrixEntries.find((entry) => entry.id === ui.selectedEntryId) || null,
)
const filteredPermissionUsers = computed(() => {
  const search = ui.userSearch.trim().toLowerCase()

  return demoPermissionUsers.filter((user) => {
    const matchesSearch =
      !search ||
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    const matchesProfile = !ui.userProfileFilter || user.profileKey === ui.userProfileFilter
    const matchesScope = !ui.userScopeFilter || user.scopeKeys.includes(ui.userScopeFilter)
    const matchesStatus = !ui.userStatusFilter || user.status === ui.userStatusFilter

    return matchesSearch && matchesProfile && matchesScope && matchesStatus
  })
})
const selectedPermissionUser = computed(
  () =>
    filteredPermissionUsers.value.find((user) => user.id === ui.selectedUserId) ||
    filteredPermissionUsers.value[0] ||
    null,
)
const selectedPermissionImpact = computed(() => {
  if (!selectedRuntimeEntry.value) {
    return null
  }

  const scopeType = selectedRuntimeEntry.value.scopeType || 'global'
  const impactScope =
    scopeType === 'global'
      ? 'amplo'
      : scopeType.startsWith('multi_')
        ? 'moderado'
        : 'local'

  return {
    impactScope,
    visibleQueueCount: selectedRuntimeEntry.value.visibleQueueCount || 0,
    visiblePolos: selectedRuntimeEntry.value.visiblePolos || [],
    administeredAreas: selectedRuntimeEntry.value.administeredAreas || [],
  }
})

watchEffect(() => {
  if (!selectedEntry.value && permissionsDraft.matrix[0]) {
    ui.selectedEntryId = permissionsDraft.matrix[0].id
  }
})

watch(
  selectedEntry,
  (entry) => {
    if (!entry) {
      return
    }

    const nextForm = buildPermissionForm(entry)
    form.id = nextForm.id
    form.profileKey = nextForm.profileKey
    form.scopeType = nextForm.scopeType
    form.scopeValues = [...(nextForm.scopeValues || [])]
    form.allowedActions = { ...(nextForm.allowedActions || {}) }
    form.note = nextForm.note || ''
  },
  { immediate: true },
)

watch(
  () => form.scopeType,
  (scopeType) => {
    if (scopeType === 'global') {
      form.scopeValues = []
      return
    }

    if (scopeType === 'polo' || scopeType === 'fila' || scopeType === 'area') {
      form.scopeValues = form.scopeValues[0] ? [form.scopeValues[0]] : []
    }
  },
)

function selectEntry(entryId) {
  ui.selectedEntryId = entryId
  ui.lastAuditMessage = ''
}

function openProfileDetail(entryId) {
  selectEntry(entryId)
  ui.profileDetailOpen = true
  ui.profileDetailTab = 'summary'
}

function openUserDetail(userId) {
  ui.selectedUserId = userId
  ui.userDetailOpen = true
  ui.userDetailTab = 'summary'
}

function updateSingleScopeValue(value) {
  form.scopeValues = value ? [value] : []
}

function toggleScopeValue(scopeValue, checked) {
  const current = new Set(form.scopeValues)

  if (checked) {
    current.add(scopeValue)
  } else {
    current.delete(scopeValue)
  }

  form.scopeValues = [...current]
}

function savePermissionChanges() {
  const auditLog = applyPermissionEntryUpdate({
    draft: permissionsDraft,
    entryId: ui.selectedEntryId,
    nextEntry: {
      profileKey: form.profileKey,
      scopeType: form.scopeType,
      scopeValues: form.scopeValues,
      allowedActions: form.allowedActions,
      note: form.note,
    },
    actor: permissionsDraft.currentActor,
    currentDate: new Date('2026-03-25T15:20:00-03:00'),
  })

  ui.lastAuditMessage = auditLog?.summary || 'Nenhuma alteracao aplicada.'
}
</script>

<template>
  <div class="grid gap-4">
    <section class="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Admin</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-950">Perfis e permissoes</h1>
        <p class="mt-1 text-sm text-slate-600">
          Regras administrativas. A permissao efetiva depende das regras integradas.
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-semibold"
          :class="ui.activeModule === 'profiles' ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
          @click="setActiveModule('profiles')"
        >
          Perfis
        </button>
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-semibold"
          :class="ui.activeModule === 'users' ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
          @click="setActiveModule('users')"
        >
          Usuarios
        </button>
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-semibold"
          :class="ui.activeModule === 'knowledge' ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
          @click="setActiveModule('knowledge')"
        >
          Conhecimento
        </button>
      </div>
    </section>

    <section
      v-if="!isMockRuntimeEnabled()"
      class="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4"
      aria-label="Acessos institucionais"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-950">Pessoas e solicitações institucionais</h2>
          <p class="text-sm text-slate-500">Dados carregados da API com alterações auditáveis.</p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-[8px] border border-slate-200 px-3 py-2 text-sm font-semibold"
            @click="livePanel.mode = 'users'; livePanel.selectedRequest = null"
          >
            Usuários ativos
          </button>
          <button
            type="button"
            class="rounded-[8px] border border-slate-200 px-3 py-2 text-sm font-semibold"
            @click="livePanel.mode = 'requests'; livePanel.selectedUser = null"
          >
            Solicitacoes pendentes
          </button>
        </div>
      </div>

      <p v-if="livePanel.error" role="alert" class="text-sm font-semibold text-red-700">
        {{ livePanel.error }}
      </p>

      <div v-if="livePanel.mode === 'users'" class="grid gap-2">
        <button
          v-for="user in liveUsers"
          :key="user.id"
          type="button"
          class="rounded-[8px] border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
          @click="openLiveUser(user)"
        >
          <span class="block font-semibold text-slate-950">{{ user.display_name }}</span>
          <span class="block text-xs text-slate-500">{{ user.email }}</span>
        </button>
      </div>

      <form
        v-if="livePanel.selectedUser"
        class="grid gap-3 rounded-[8px] bg-slate-50 p-4"
        @submit.prevent="saveLiveUser"
      >
        <h3 class="font-semibold text-slate-950">{{ livePanel.selectedUser.display_name }}</h3>
        <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input v-model="livePanel.userActive" type="checkbox" />
          Usuario ativo
        </label>
        <input
          v-model="livePanel.userReason"
          type="text"
          class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Obrigatorio para auditoria"
        />
        <button type="submit" class="w-fit rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>

      <div v-if="livePanel.mode === 'requests'" class="grid gap-2">
        <button
          v-for="request in liveAccessRequests"
          :key="request.id"
          type="button"
          class="rounded-[8px] border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
          @click="openLiveRequest(request)"
        >
          <span class="block font-semibold text-slate-950">{{ request.display_name }}</span>
          <span class="block text-xs text-slate-500">{{ request.email }}</span>
        </button>
      </div>

      <form
        v-if="livePanel.selectedRequest"
        class="grid gap-3 rounded-[8px] bg-slate-50 p-4"
        @submit.prevent="approveLiveRequest"
      >
        <h3 class="font-semibold text-slate-950">{{ livePanel.selectedRequest.display_name }}</h3>
        <label class="grid gap-1 text-sm font-semibold text-slate-700">
          <span>Perfil</span>
          <select
            v-model="livePanel.approvalProfile"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2"
          >
            <option value="">Selecione</option>
            <option v-for="profile in liveCatalogs.profiles" :key="profile.key" :value="profile.key">
              {{ profile.label }}
            </option>
          </select>
        </label>
        <div v-if="approvalScopeDimensions.length" class="grid gap-3">
          <p class="text-sm font-semibold text-slate-700">Escopos operacionais</p>
          <div
            v-for="dimension in approvalScopeDimensions"
            :key="dimension"
            class="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-3"
          >
            <p class="text-sm font-semibold text-slate-700">
              {{ SCOPE_DIMENSION_LABELS[dimension] || dimension }}
            </p>
            <label
              v-for="item in scopeCatalogFor(dimension)"
              :key="`${dimension}-${item.value}`"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                v-model="livePanel.approvalScopes[dimension]"
                type="checkbox"
                :value="item.value"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>
          <p class="text-sm leading-6 text-slate-600">{{ approvalScopeSummary }}</p>
        </div>
        <label class="grid gap-1 text-sm font-semibold text-slate-700">
          <span>Motivo da decisao</span>
          <input
            v-model="livePanel.approvalReason"
            type="text"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <button type="submit" class="w-fit rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          Aprovar acesso
        </button>
      </form>
    </section>

    <template v-if="ui.activeModule === 'profiles'">
      <section
        v-if="!ui.profileDetailOpen"
        class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"
      >
        <div class="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
          <span>Perfil</span>
          <span>Escopo</span>
          <span>Visibilidade</span>
          <span>Operacao</span>
          <span>Usuarios</span>
          <span>Risco</span>
          <span class="text-right">Acoes</span>
        </div>
        <button
          v-for="profile in runtime.profileImpacts"
          :key="profile.key"
          type="button"
          class="grid w-full grid-cols-[1.2fr_1fr_1fr_1fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50"
          @click="openProfileDetail((runtime.matrixEntries.find((entry) => entry.profileKey === profile.key) || {}).id)"
        >
          <span>
            <span class="block font-semibold text-slate-950">{{ profile.label }}</span>
            <span class="block text-xs text-slate-500">{{ profile.key }}</span>
          </span>
          <span class="truncate text-slate-700">
            {{ (runtime.matrixEntries.find((entry) => entry.profileKey === profile.key) || {}).scopeLabel || 'Sem escopo' }}
          </span>
          <span class="truncate text-slate-700">{{ profile.visibleQueues.length || profile.visiblePolos.length }} alcance(s)</span>
          <span class="truncate text-slate-700">{{ profile.allowedActions.length }} acao(oes)</span>
          <span class="text-slate-700">
            {{ demoPermissionUsers.filter((user) => user.profileKey === profile.key).length || 'demo' }}
          </span>
          <span>
            <StatusBadge
              :label="runtime.matrixEntries.some((entry) => entry.profileKey === profile.key && entry.allowedActionList.some((action) => action.governance)) ? 'critico' : 'baixo'"
            />
          </span>
          <span class="text-right font-semibold text-[var(--color-primary)]">Ver</span>
        </button>
      </section>

      <section
        v-else-if="selectedEntry && selectedRuntimeEntry"
        class="grid gap-4"
      >
        <div class="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              class="text-sm font-semibold text-[var(--color-primary)]"
              @click="ui.profileDetailOpen = false"
            >
              Voltar para perfis
            </button>
            <h2 class="mt-3 text-2xl font-semibold text-slate-950">{{ selectedRuntimeEntry.profileLabel }}</h2>
            <p class="mt-1 text-sm text-slate-600">{{ selectedRuntimeEntry.scopeLabel }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="`${demoPermissionUsers.filter((user) => user.profileKey === selectedRuntimeEntry.profileKey).length} usuarios demo`" />
            <StatusBadge :label="`${selectedRuntimeEntry.allowedActionList.filter((action) => action.governance).length} criticas`" />
            <StatusBadge :label="selectedPermissionImpact?.impactScope || 'local'" />
            <StatusBadge label="rev. demo" />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in ['summary', 'permissions', 'users', 'audit', 'advanced']"
            :key="tab"
            type="button"
            class="rounded-full border px-3 py-1.5 text-sm font-semibold"
            :class="ui.profileDetailTab === tab ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
            @click="ui.profileDetailTab = tab"
          >
            {{ { summary: 'Resumo', permissions: 'Permissoes', users: 'Usuarios', audit: 'Auditoria', advanced: 'Avancado' }[tab] }}
          </button>
        </div>

        <section
          v-if="ui.profileDetailTab === 'summary'"
          class="grid gap-3 rounded-[8px] border border-slate-200 bg-white p-4 lg:grid-cols-4"
        >
          <div>
            <p class="text-xs font-semibold text-slate-500">Visibilidade</p>
            <p class="mt-1 truncate text-sm font-semibold text-slate-950">{{ selectedRuntimeEntry.visibleQueues.join(', ') || selectedRuntimeEntry.visiblePolos.join(', ') || 'Sem alcance' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">Operacao</p>
            <p class="mt-1 truncate text-sm font-semibold text-slate-950">{{ selectedRuntimeEntry.allowedActionList.filter((action) => !action.governance).map((action) => action.label).join(', ') || 'Nenhuma' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">Governanca</p>
            <p class="mt-1 truncate text-sm font-semibold text-slate-950">{{ selectedRuntimeEntry.allowedActionList.filter((action) => action.governance).map((action) => action.label).join(', ') || 'Sem acoes criticas' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">Permissao efetiva</p>
            <p class="mt-1 text-sm font-semibold text-slate-950">Validada nas regras integradas</p>
          </div>
        </section>

        <section
          v-else-if="ui.profileDetailTab === 'permissions'"
          class="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4"
        >
          <div
            v-if="form.scopeType === 'global' || form.allowedActions.publish_version || form.allowedActions.edit_parameters || form.allowedActions.edit_faq || form.allowedActions.view_audit || form.allowedActions.reassign"
            class="rounded-[8px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
          >
            Revise escopo amplo ou acao critica antes de salvar.
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Perfil</span>
              <select
                v-model="form.profileKey"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option
                  v-for="profile in runtime.catalogs.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </option>
              </select>
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-600">Escopo</span>
              <select
                v-model="form.scopeType"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option
                  v-for="scope in runtime.catalogs.scopeTypes"
                  :key="scope.value"
                  :value="scope.value"
                >
                  {{ scope.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="grid gap-3">
            <label
              v-if="form.scopeType === 'polo'"
              class="grid gap-2"
            >
              <span class="text-sm font-semibold text-slate-600">Polo</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="polo in runtime.catalogs.polos"
                  :key="polo.value"
                  :value="polo.value"
                >
                  {{ polo.label }}
                </option>
              </select>
            </label>
            <label
              v-else-if="form.scopeType === 'fila'"
              class="grid gap-2"
            >
              <span class="text-sm font-semibold text-slate-600">Fila</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="queue in runtime.catalogs.queues"
                  :key="queue.value"
                  :value="queue.value"
                >
                  {{ queue.label }}
                </option>
              </select>
            </label>
            <label
              v-else-if="form.scopeType === 'area'"
              class="grid gap-2"
            >
              <span class="text-sm font-semibold text-slate-600">Area</span>
              <select
                :value="form.scopeValues[0] || ''"
                class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                @change="updateSingleScopeValue($event.target.value)"
              >
                <option value="">Selecione</option>
                <option
                  v-for="area in runtime.catalogs.areas"
                  :key="area.value"
                  :value="area.value"
                >
                  {{ area.label }}
                </option>
              </select>
            </label>
            <div
              v-else-if="form.scopeType === 'multi_polo' || form.scopeType === 'multi_fila' || form.scopeType === 'multi_area'"
              class="grid gap-2 md:grid-cols-2"
            >
              <label
                v-for="item in form.scopeType === 'multi_polo' ? runtime.catalogs.polos : form.scopeType === 'multi_fila' ? runtime.catalogs.queues : runtime.catalogs.areas"
                :key="item.value"
                class="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <span>{{ item.label }}</span>
                <input
                  :checked="form.scopeValues.includes(item.value)"
                  type="checkbox"
                  @change="toggleScopeValue(item.value, $event.target.checked)"
                />
              </label>
            </div>
            <p
              v-else
              class="rounded-[8px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Escopo global.
            </p>
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <section class="grid gap-2">
              <p class="text-sm font-semibold text-slate-700">Operacao</p>
              <label
                v-for="action in runtime.catalogs.actions.filter((item) => !item.governance)"
                :key="action.value"
                class="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <span>{{ action.label }}</span>
                <input
                  v-model="form.allowedActions[action.value]"
                  type="checkbox"
                />
              </label>
            </section>
            <section class="grid gap-2">
              <p class="text-sm font-semibold text-slate-700">Governanca avancada</p>
              <label
                v-for="action in runtime.catalogs.actions.filter((item) => item.governance)"
                :key="action.value"
                class="flex items-center justify-between rounded-[8px] bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
              >
                <span>{{ action.label }}</span>
                <input
                  v-model="form.allowedActions[action.value]"
                  type="checkbox"
                />
              </label>
            </section>
          </div>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-600">Observacao</span>
            <textarea
              v-model="form.note"
              rows="3"
              class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
            ></textarea>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-[8px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
              @click="savePermissionChanges"
            >
              Salvar alteracao
            </button>
            <span
              v-if="ui.lastAuditMessage"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
            >
              {{ ui.lastAuditMessage }}
            </span>
          </div>
        </section>

        <section
          v-else-if="ui.profileDetailTab === 'users'"
          class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"
        >
          <div
            v-for="user in demoPermissionUsers.filter((item) => item.profileKey === selectedRuntimeEntry.profileKey)"
            :key="user.id"
            class="crm-filter-grid border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
          >
            <span class="font-semibold text-slate-950">{{ user.name }}</span>
            <span class="text-slate-600">{{ user.scopeLabel }}</span>
            <span class="text-slate-600">{{ user.activity }}</span>
          </div>
        </section>

        <section
          v-else-if="ui.profileDetailTab === 'audit'"
          class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"
        >
          <div
            v-for="log in runtime.auditLogs"
            :key="log.id"
            class="border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
          >
            <p class="font-semibold text-slate-950">{{ log.summary }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ log.actorName }} - {{ log.changedAtLabel }}</p>
          </div>
        </section>

        <section
          v-else
          class="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4"
        >
          <div>
            <p class="text-sm font-semibold text-slate-950">Matriz completa</p>
            <div class="mt-3 overflow-hidden rounded-[8px] border border-slate-200">
              <button
                v-for="entry in runtime.matrixEntries"
                :key="entry.id"
                type="button"
                class="grid w-full grid-cols-[1fr_1fr_0.6fr] gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                :class="{ 'bg-[rgba(209,50,57,0.06)]': ui.selectedEntryId === entry.id }"
                @click="selectEntry(entry.id)"
              >
                <span class="font-semibold text-slate-900">{{ entry.profileLabel }}</span>
                <span class="truncate text-slate-600">{{ entry.scopeLabel }}</span>
                <span class="text-right text-[var(--color-primary)]">Editar</span>
              </button>
            </div>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-950">Filas visiveis</p>
            <div class="mt-3 grid gap-2 md:grid-cols-2">
              <p
                v-for="queue in runtime.queueVisibility"
                :key="queue.queue"
                class="rounded-[8px] bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                {{ queue.queue }}: {{ queue.profiles.join(', ') || 'Nenhum' }}
              </p>
            </div>
          </div>
          <section class="crm-filter-grid--dense">
            <MetricCard
              v-for="metric in runtime.metrics"
              :key="metric.label"
              :label="metric.label"
              :value="metric.value"
              :hint="metric.hint"
            />
          </section>
        </section>
      </section>
    </template>

    <template v-else-if="ui.activeModule === 'users'">
      <section
        v-if="!ui.userDetailOpen"
        class="grid gap-3"
      >
        <div class="crm-filter-grid--dense rounded-[8px] border border-slate-200 bg-white p-4">
          <input
            v-model="ui.userSearch"
            type="search"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            placeholder="Buscar usuario"
          />
          <select
            v-model="ui.userProfileFilter"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Todos os perfis</option>
            <option
              v-for="profile in runtime.catalogs.profiles"
              :key="profile.value"
              :value="profile.value"
            >
              {{ profile.label }}
            </option>
          </select>
          <select
            v-model="ui.userScopeFilter"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Todo alcance</option>
            <option
              v-for="area in runtime.catalogs.areas"
              :key="`area-${area.value}`"
              :value="`area:${area.value}`"
            >
              Area: {{ area.label }}
            </option>
            <option
              v-for="queue in runtime.catalogs.queues"
              :key="`queue-${queue.value}`"
              :value="`queue:${queue.value}`"
            >
              Fila: {{ queue.label }}
            </option>
            <option
              v-for="polo in runtime.catalogs.polos"
              :key="`polo-${polo.value}`"
              :value="`polo:${polo.value}`"
            >
              Polo: {{ polo.label }}
            </option>
          </select>
          <select
            v-model="ui.userStatusFilter"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <p class="text-xs font-semibold text-slate-500">
          Dados demonstrativos para validar a experiencia. A integracao real deve trazer usuarios, desempenho e permissoes efetivas do backend.
        </p>

        <section class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white">
          <div class="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.7fr_0.7fr_1fr_0.5fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>Nome</span>
            <span>E-mail</span>
            <span>Perfil</span>
            <span>Area/Fila/Polo</span>
            <span>Status</span>
            <span>Risco</span>
            <span>Atividade</span>
            <span class="text-right">Acoes</span>
          </div>
          <button
            v-for="user in filteredPermissionUsers"
            :key="user.id"
            type="button"
            class="grid w-full grid-cols-[1.2fr_1.2fr_1fr_1fr_0.7fr_0.7fr_1fr_0.5fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50"
            @click="openUserDetail(user.id)"
          >
            <span class="font-semibold text-slate-950">{{ user.name }}</span>
            <span class="truncate text-slate-600">{{ user.email }}</span>
            <span class="truncate text-slate-700">{{ user.profileLabel }}</span>
            <span class="truncate text-slate-600">{{ user.scopeLabel }}</span>
            <span><StatusBadge :label="user.status" /></span>
            <span><StatusBadge :label="user.critical ? 'critico' : 'baixo'" /></span>
            <span class="truncate text-slate-600">{{ user.activity }}</span>
            <span class="text-right font-semibold text-[var(--color-primary)]">Ver</span>
          </button>
          <p
            v-if="filteredPermissionUsers.length === 0"
            class="px-4 py-5 text-sm text-slate-600"
          >
            Nenhum usuario demonstrativo encontrado.
          </p>
        </section>
      </section>

      <section
        v-else-if="selectedPermissionUser"
        class="grid gap-4"
      >
        <div class="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              class="text-sm font-semibold text-[var(--color-primary)]"
              @click="ui.userDetailOpen = false"
            >
              Voltar para usuarios
            </button>
            <h2 class="mt-3 text-2xl font-semibold text-slate-950">{{ selectedPermissionUser.name }}</h2>
            <p class="mt-1 text-sm text-slate-600">{{ selectedPermissionUser.email }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="selectedPermissionUser.profileLabel" />
            <StatusBadge :label="selectedPermissionUser.status" />
            <StatusBadge :label="selectedPermissionUser.critical ? 'critico' : 'baixo'" />
          </div>
        </div>

        <section class="grid gap-3 rounded-[8px] border border-slate-200 bg-white p-4 lg:grid-cols-4">
          <div>
            <p class="text-xs font-semibold text-slate-500">Casos tratados</p>
            <p class="mt-1 text-xl font-semibold text-slate-950">{{ selectedPermissionUser.handledCases }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">SLA medio</p>
            <p class="mt-1 text-xl font-semibold text-slate-950">{{ selectedPermissionUser.avgSla }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">Reatribuicoes</p>
            <p class="mt-1 text-xl font-semibold text-slate-950">{{ selectedPermissionUser.reassignments }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500">Acoes criticas</p>
            <p class="mt-1 text-xl font-semibold text-slate-950">{{ selectedPermissionUser.critical ? 1 : 0 }}</p>
          </div>
        </section>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in ['summary', 'effective', 'performance', 'audit']"
            :key="tab"
            type="button"
            class="rounded-full border px-3 py-1.5 text-sm font-semibold"
            :class="ui.userDetailTab === tab ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
            @click="ui.userDetailTab = tab"
          >
            {{ { summary: 'Resumo', effective: 'Permissoes efetivas', performance: 'Performance', audit: 'Auditoria' }[tab] }}
          </button>
        </div>

        <section class="rounded-[8px] border border-slate-200 bg-white p-4">
          <div
            v-if="ui.userDetailTab === 'summary'"
            class="grid gap-3 lg:grid-cols-4"
          >
            <p><span class="block text-xs font-semibold text-slate-500">Perfil</span><span class="text-sm font-semibold text-slate-950">{{ selectedPermissionUser.profileLabel }}</span></p>
            <p><span class="block text-xs font-semibold text-slate-500">Alcance</span><span class="text-sm font-semibold text-slate-950">{{ selectedPermissionUser.scopeLabel }}</span></p>
            <p><span class="block text-xs font-semibold text-slate-500">Status</span><span class="text-sm font-semibold text-slate-950">{{ selectedPermissionUser.status }}</span></p>
            <p><span class="block text-xs font-semibold text-slate-500">Atividade</span><span class="text-sm font-semibold text-slate-950">{{ selectedPermissionUser.activity }}</span></p>
          </div>
          <p
            v-else-if="ui.userDetailTab === 'effective'"
            class="text-sm leading-6 text-slate-700"
          >
            Permissao efetiva demonstrativa: {{ selectedPermissionUser.profileLabel }} em {{ selectedPermissionUser.scopeLabel }}. A validacao real depende das regras integradas.
          </p>
          <p
            v-else-if="ui.userDetailTab === 'performance'"
            class="text-sm leading-6 text-slate-700"
          >
            Dados demonstrativos: {{ selectedPermissionUser.handledCases }} casos tratados, SLA medio {{ selectedPermissionUser.avgSla }} e {{ selectedPermissionUser.reassignments }} reatribuicao(oes).
          </p>
          <p
            v-else
            class="text-sm leading-6 text-slate-700"
          >
            Auditoria demonstrativa. A integracao real deve trazer eventos, alteracoes de perfil e atividade administrativa.
          </p>
        </section>
      </section>
    </template>

    <template v-else-if="ui.activeModule === 'knowledge'">
      <section class="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-950">Conhecimento e FAQ</h2>
          <p class="mt-1 text-sm text-slate-600">
            Concessões de sugestão por tema para OP e BPO. Alterações aqui refletem na biblioteca e
            no editor.
          </p>
        </div>

        <div class="grid gap-2 rounded-[8px] border border-slate-100 bg-slate-50 p-3">
          <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Ações do módulo
          </p>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li
              v-for="action in knowledgeActionCatalog"
              :key="action.key"
              class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span class="font-semibold text-slate-950">{{ action.label }}</span>
              <span class="mt-1 block text-slate-600">{{ action.description }}</span>
            </li>
          </ul>
        </div>

        <label class="grid max-w-md gap-1 text-sm font-semibold text-slate-700">
          <span>Filtrar por tema</span>
          <select
            v-model="knowledgeThemeFilter"
            class="rounded-[8px] border border-slate-200 bg-white px-3 py-2"
          >
            <option value="">Todos os temas</option>
            <option
              v-for="theme in knowledgeThemes"
              :key="theme.theme_key"
              :value="theme.theme_key"
            >
              {{ theme.theme_label }}
            </option>
          </select>
        </label>

        <FaqKnowledgeGrantsPanel
          :loading="grantsLoading"
          :saving="grantsSaving"
          :error-message="grantsErrorMessage"
          :success-message="grantsSuccessMessage"
          :grant-form="grantForm"
          :grant-subjects="grantSubjects"
          :eligible-grant-profiles="eligibleGrantProfiles"
          :contributor-assignments="contributorAssignments"
          :themes="knowledgeThemes"
          :theme-filter="knowledgeThemeFilter"
          @submit="grantSuggestionAccess()"
          @revoke="revokeSuggestionAccess"
          @subject-type-change="grantForm.subject_id = ''; onGrantSubjectChange()"
          @subject-change="onGrantSubjectChange()"
        />
      </section>
    </template>
  </div>
</template>
