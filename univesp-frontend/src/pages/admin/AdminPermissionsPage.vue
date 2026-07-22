<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import StatusBadge from '@/components/StatusBadge.vue'
import {
  approveAccessRequest,
  createAdminUser,
  getAdminCatalogs,
  getAdminUser,
  listAccessAudit,
  listAccessRequests,
  listAdminUsers,
  rejectAccessRequest,
  updateAdminUser,
} from '@/services/appApi'
import {
  createAccessGroup,
  createPermissionProfile,
  listAccessGroups,
  listPermissionProfiles,
} from '@/services/appApi'

const customAccessEnabled =
  String(import.meta.env.VITE_ENABLE_CUSTOM_PERMISSION_PROFILES || '').toLowerCase() === 'true'

const tabs = Object.freeze([
  ...(customAccessEnabled
    ? [{ key: 'profiles', label: 'Perfis de acesso' }, { key: 'groups', label: 'Grupos' }]
    : []),
  { key: 'people', label: 'Pessoas' },
  { key: 'requests', label: 'Solicitacoes pendentes' },
  { key: 'audit', label: 'Auditoria' },
])

const capabilityLabels = Object.freeze({
  create_ticket: 'Abrir solicitacao',
  view_ticket: 'Consultar solicitacoes',
  reply_ticket: 'Responder solicitacoes',
  attach_ticket: 'Adicionar anexos',
  assign_ticket: 'Atribuir atendimento',
  transition_ticket: 'Alterar etapa do atendimento',
  manage_users: 'Gerenciar pessoas',
  view_audit: 'Consultar auditoria',
  view_area_guidance: 'Consultar orientacao interna',
  manage_area_scope: 'Gerenciar escopos de area',
  edit_faq: 'Editar FAQs',
  edit_parameters: 'Editar regras e prazos',
  publish_version: 'Publicar versoes',
  approve_knowledge: 'Aprovar conhecimento',
  publish_knowledge_version: 'Publicar conhecimento',
  manage_user_availability: 'Gerenciar disponibilidade',
  manage_assignment_policies: 'Gerenciar distribuicao',
  manage_permission_profiles: 'Gerenciar perfis e grupos',
  simulate_student_generic: 'Visualizar aluno generico',
  simulate_student_real: 'Visualizar aluno real',
  simulate_op_generic: 'Visualizar OP generico',
  simulate_op_real: 'Visualizar OP real',
  simulate_view_attachments: 'Visualizar conteudo de anexo simulado',
})
const activeTab = ref('people')
const loading = ref(false)
const saving = ref(false)
const feedback = reactive({ type: '', message: '', requestId: '' })
const catalogs = reactive({ profiles: [], queues: [], polos: [], areas: [] })
const users = ref([])
const requests = ref([])
const permissionProfiles = ref([])
const accessGroups = ref([])
const profileEditorOpen = ref(false)
const groupEditorOpen = ref(false)
const permissionProfileForm = reactive(emptyPermissionProfileForm())
const accessGroupForm = reactive(emptyAccessGroupForm())
const auditRows = ref([])
const userMeta = reactive({ page: 1, pageSize: 25, total: 0 })
const requestMeta = reactive({ page: 1, pageSize: 25, total: 0 })
const filters = reactive({ search: '', profile: '', status: '', scope: '' })
const requestFilters = reactive({ search: '', status: 'pending' })
const selectedUserAudit = ref([])
const selectedRequest = ref(null)
const editorOpen = ref(false)
const editorMode = ref('create')
const form = reactive(emptyForm())
const approval = reactive(emptyApproval())

const selectedProfile = computed(
  () => catalogs.profiles.find((profile) => profile.key === form.profileKey) || null,
)
const selectedApprovalProfile = computed(
  () => catalogs.profiles.find((profile) => profile.key === approval.profileKey) || null,
)
const scopeOptions = computed(() => optionsForScope(selectedProfile.value?.scope_key))
const approvalScopeOptions = computed(() => optionsForScope(selectedApprovalProfile.value?.scope_key))
const totalPages = computed(() => Math.max(Math.ceil(userMeta.total / userMeta.pageSize), 1))
const availableCapabilities = computed(() => {
  const profile = catalogs.profiles.find(
    (item) => item.key === permissionProfileForm.basePersona,
  )
  return profile?.actions || []
})
const requestTotalPages = computed(() =>
  Math.max(Math.ceil(requestMeta.total / requestMeta.pageSize), 1),
)

onMounted(loadInitial)

async function loadInitial() {
  loading.value = true
  clearFeedback()
  try {
    const [catalogResult, userResult, requestResult, auditResult, profileResult, groupResult] = await Promise.all([
      getAdminCatalogs(),
      listAdminUsers({ page: 1, page_size: userMeta.pageSize }),
      listAccessRequests({ page: 1, page_size: requestMeta.pageSize, status: 'pending' }),
      listAccessAudit({ page: 1, page_size: 25 }),
      customAccessEnabled
        ? listPermissionProfiles()
        : Promise.resolve({ data: [] }),
      customAccessEnabled
        ? listAccessGroups()
        : Promise.resolve({ data: [] }),
    ])
    Object.assign(catalogs, catalogResult.data || {})
    applyUserResult(userResult)
    applyRequestResult(requestResult)
    auditRows.value = auditResult.data || []
    permissionProfiles.value = profileResult.data || []
    accessGroups.value = groupResult.data || []
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function loadUsers(page = 1) {
  loading.value = true
  clearFeedback()
  try {
    const result = await listAdminUsers({
      page,
      page_size: userMeta.pageSize,
      search: filters.search,
      profile: filters.profile,
      status: filters.status,
      scope: filters.scope,
    })
    applyUserResult(result)
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function loadRequests(page = 1) {
  loading.value = true
  clearFeedback()
  try {
    const result = await listAccessRequests({
      page,
      page_size: requestMeta.pageSize,
      search: requestFilters.search,
      status: requestFilters.status,
    })
    applyRequestResult(result)
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function loadAudit() {
  loading.value = true
  clearFeedback()
  try {
    const result = await listAccessAudit({ page: 1, page_size: 100 })
    auditRows.value = result.data || []
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

function applyUserResult(result) {
  users.value = result.data || []
  userMeta.page = result.meta?.page || 1
  userMeta.total = result.meta?.total || 0
}

function applyRequestResult(result) {
  requests.value = result.data || []
  requestMeta.page = result.meta?.page || 1
  requestMeta.total = result.meta?.total || 0
}

function openCreate() {
  editorMode.value = 'create'
  Object.assign(form, emptyForm())
  selectedUserAudit.value = []
  editorOpen.value = true
  clearFeedback()
}

async function openEdit(user) {
  loading.value = true
  clearFeedback()
  try {
    const result = await getAdminUser(user.email)
    const detail = result.data
    editorMode.value = 'edit'
    Object.assign(form, {
      email: detail.email,
      displayName: detail.display_name,
      ra: detail.ra || '',
      profileKey: detail.profile_key,
      active: detail.active,
      scopes: valuesForProfile(detail.profile_key, detail.scopes),
      reason: '',
      version: detail.version,
    })
    selectedUserAudit.value = detail.audit || []
    editorOpen.value = true
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

async function saveUser() {
  if (!validateEditor(form, selectedProfile.value)) return
  saving.value = true
  clearFeedback()
  try {
    const payload = {
      display_name: form.displayName,
      ra: form.ra,
      profile_key: form.profileKey,
      active: form.active,
      scopes: scopesPayload(selectedProfile.value?.scope_key, form.scopes),
      reason: form.reason,
      ...(editorMode.value === 'edit' ? { version: form.version } : {}),
    }
    if (editorMode.value === 'create') {
      await createAdminUser({ ...payload, email: form.email })
    } else {
      await updateAdminUser(form.email, payload)
    }
    editorOpen.value = false
    showSuccess(editorMode.value === 'create' ? 'Usuario cadastrado.' : 'Usuario atualizado.')
    await Promise.all([loadUsers(userMeta.page), loadAudit()])
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

function openRequest(request) {
  selectedRequest.value = request
  Object.assign(approval, {
    displayName: request.display_name,
    ra: request.ra || '',
    profileKey: request.identity_flow === 'aluno' ? 'aluno' : '',
    scopes: [],
    reason: '',
  })
  clearFeedback()
}

async function approveRequest() {
  if (!validateEditor(approval, selectedApprovalProfile.value)) return
  saving.value = true
  clearFeedback()
  try {
    await approveAccessRequest(selectedRequest.value.id, {
      display_name: approval.displayName,
      ra: approval.ra,
      profile_key: approval.profileKey,
      scopes: scopesPayload(selectedApprovalProfile.value?.scope_key, approval.scopes),
      reason: approval.reason,
    })
    selectedRequest.value = null
    showSuccess('Solicitacao aprovada e perfil criado.')
    await Promise.all([loadRequests(requestMeta.page), loadUsers(1), loadAudit()])
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function rejectRequest() {
  if (approval.reason.trim().length < 5) {
    feedback.type = 'error'
    feedback.message = 'Informe um motivo com pelo menos 5 caracteres.'
    return
  }
  saving.value = true
  clearFeedback()
  try {
    await rejectAccessRequest(selectedRequest.value.id, { reason: approval.reason })
    selectedRequest.value = null
    showSuccess('Solicitacao rejeitada.')
    await Promise.all([loadRequests(requestMeta.page), loadAudit()])
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

function setProfile(target, profileKey) {
  target.profileKey = profileKey
  target.scopes = []
}

function toggleScope(target, value, checked) {
  const values = new Set(target.scopes)
  if (checked) values.add(value)
  else values.delete(value)
  target.scopes = [...values]
}

function optionsForScope(scopeKey) {
  if (scopeKey === 'queues') return catalogs.queues
  if (scopeKey === 'polos') return catalogs.polos
  if (scopeKey === 'areas') return catalogs.areas
  return []
}

function valuesForProfile(profileKey, scopes = {}) {
  const profile = catalogs.profiles.find((entry) => entry.key === profileKey)
  return profile?.scope_key ? [...(scopes[profile.scope_key] || [])] : []
}

function scopesPayload(scopeKey, values) {
  return scopeKey ? { [scopeKey]: [...values] } : {}
}
async function refreshPermissionProfiles() {
  const result = await listPermissionProfiles()
  permissionProfiles.value = result.data || []
}

async function refreshAccessGroups() {
  const result = await listAccessGroups()
  accessGroups.value = result.data || []
}

function openPermissionProfileCreate() {
  Object.assign(permissionProfileForm, emptyPermissionProfileForm())
  profileEditorOpen.value = true
  clearFeedback()
}

async function savePermissionProfile() {
  saving.value = true
  clearFeedback()
  try {
    const base = catalogs.profiles.find((item) => item.key === permissionProfileForm.basePersona)
    await createPermissionProfile({
      label: permissionProfileForm.label,
      base_persona: permissionProfileForm.basePersona,
      scope_type: base?.scope_key || '',
      capabilities: permissionProfileForm.capabilities,
      reason: permissionProfileForm.reason,
    })
    profileEditorOpen.value = false
    await refreshPermissionProfiles()
    showSuccess('Perfil de acesso criado.')
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

function openAccessGroupCreate() {
  Object.assign(accessGroupForm, emptyAccessGroupForm())
  groupEditorOpen.value = true
  clearFeedback()
}

async function saveAccessGroup() {
  saving.value = true
  clearFeedback()
  try {
    const members = accessGroupForm.membersText
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean)
    await createAccessGroup({
      label: accessGroupForm.label,
      permission_profile: accessGroupForm.permissionProfile,
      members,
      scopes: {},
      external_id: accessGroupForm.externalId,
      reason: accessGroupForm.reason,
    })
    groupEditorOpen.value = false
    await refreshAccessGroups()
    showSuccess('Grupo criado.')
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

function toggleCapability(capability, enabled) {
  const current = permissionProfileForm.capabilities
  if (enabled && !current.includes(capability)) current.push(capability)
  if (!enabled) permissionProfileForm.capabilities = current.filter((item) => item !== capability)
}

function capabilityLabel(capability) {
  return capabilityLabels[capability] || 'Permissao adicional'
}

function emptyPermissionProfileForm() {
  return { label: '', basePersona: '', capabilities: [], reason: '' }
}

function emptyAccessGroupForm() {
  return { label: '', permissionProfile: '', membersText: '', externalId: '', reason: '' }
}

function validateEditor(target, profile) {
  if (!target.displayName.trim() || !target.profileKey) {
    feedback.type = 'error'
    feedback.message = 'Nome e perfil sao obrigatorios.'
    return false
  }
  if ('email' in target && (!target.email.includes('@') || !target.email.trim())) {
    feedback.type = 'error'
    feedback.message = 'Informe um email valido.'
    return false
  }
  if (profile?.scope_key && target.scopes.length === 0) {
    feedback.type = 'error'
    feedback.message = 'Selecione ao menos um escopo para o perfil.'
    return false
  }
  if (target.reason.trim().length < 5) {
    feedback.type = 'error'
    feedback.message = 'Informe um motivo com pelo menos 5 caracteres.'
    return false
  }
  return true
}

function emptyForm() {
  return { email: '', displayName: '', ra: '', profileKey: '', active: true, scopes: [], reason: '', version: '' }
}

function emptyApproval() {
  return { displayName: '', ra: '', profileKey: '', scopes: [], reason: '' }
}

function profileLabel(key) {
  return catalogs.profiles.find((profile) => profile.key === key)?.label || key
}

function scopeLabel(user) {
  const values = Object.values(user.scopes || {}).flat()
  return values.length ? values.join(', ') : 'Global'
}

function formatDate(value) {
  if (!value) return 'Sem registro'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function showSuccess(message) {
  feedback.type = 'success'
  feedback.message = message
  feedback.requestId = ''
}

function showError(error) {
  feedback.type = 'error'
  feedback.message = error?.message || 'Nao foi possivel concluir a operacao.'
  feedback.requestId = error?.requestId || ''
}

function clearFeedback() {
  feedback.type = ''
  feedback.message = ''
  feedback.requestId = ''
}
</script>

<template>
  <div class="grid gap-4">
    <header class="border-b border-slate-200 pb-4">
      <p class="text-xs font-semibold uppercase text-slate-500">Admin</p>
      <div class="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">Usuarios e autorizacoes</h1>
          <p class="mt-1 text-sm text-slate-600">SSO para identidade; perfil e escopo para acesso ao atendimento.</p>
        </div>
        <nav class="flex flex-wrap gap-1" aria-label="Modulos de autorizacao">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="min-h-10 border px-3 text-sm font-semibold"
            :class="activeTab === tab.key ? 'border-[var(--color-primary)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary)]' : 'border-slate-200 bg-white text-slate-600'"
            @click="activeTab = tab.key; editorOpen = false; selectedRequest = null"
          >
            {{ tab.label }}
            <span v-if="tab.key === 'requests' && requestMeta.total" class="ml-1">({{ requestMeta.total }})</span>
          </button>
        </nav>
      </div>
    </header>

    <div
      v-if="feedback.message"
      class="border px-4 py-3 text-sm font-semibold"
      :class="feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'"
      role="status"
    >
      {{ feedback.message }}
      <span v-if="feedback.requestId" class="ml-2 font-normal">ID: {{ feedback.requestId }}</span>
    </div>

    <p v-if="loading" class="py-8 text-center text-sm font-semibold text-slate-500">Carregando dados...</p>

    <template v-else-if="activeTab === 'profiles'">
      <section v-if="!profileEditorOpen" class="grid gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-600">Crie conjuntos de permissoes que possam ser reutilizados.</p>
          <button type="button" class="rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-white" @click="openPermissionProfileCreate">
            Novo perfil
          </button>
        </div>
        <div class="grid gap-3 lg:grid-cols-2">
          <article v-for="profile in permissionProfiles" :key="profile.id" class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="font-semibold text-slate-950">{{ profile.label }}</h2>
                <p class="mt-1 text-sm text-slate-600">Base: {{ profileLabel(profile.base_persona) }}</p>
              </div>
              <StatusBadge :label="profile.active ? 'ativo' : 'inativo'" />
            </div>
            <p v-if="profile.system_profile" class="mt-3 text-xs font-semibold text-slate-500">Perfil institucional protegido</p>
            <div class="mt-3 flex flex-wrap gap-1">
              <span v-for="capability in profile.capabilities" :key="capability" class="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {{ capabilityLabel(capability) }}
              </span>
            </div>
          </article>
          <p v-if="permissionProfiles.length === 0" class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nenhum perfil cadastrado. Execute a migracao da aplicacao antes de liberar esta tela.
          </p>
        </div>
      </section>
      <section v-else class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <button type="button" class="font-semibold text-[var(--color-primary)]" @click="profileEditorOpen = false">Voltar</button>
          <h2 class="mt-2 text-xl font-semibold text-slate-950">Novo perfil de acesso</h2>
        </div>
        <label class="grid gap-1 font-semibold text-slate-800">Nome
          <input v-model="permissionProfileForm.label" class="rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="grid gap-1 font-semibold text-slate-800">Perfil base
          <select v-model="permissionProfileForm.basePersona" class="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">Selecione</option>
            <option v-for="profile in catalogs.profiles" :key="profile.key" :value="profile.key">{{ profile.label }}</option>
          </select>
        </label>
        <fieldset class="grid gap-2">
          <legend class="font-semibold text-slate-800">Permissoes</legend>
          <label v-for="capability in availableCapabilities" :key="capability" class="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3">
            <input type="checkbox" :checked="permissionProfileForm.capabilities.includes(capability)" @change="toggleCapability(capability, $event.target.checked)" />
            <span>{{ capabilityLabel(capability) }}</span>
          </label>
        </fieldset>
        <label class="grid gap-1 font-semibold text-slate-800">Motivo
          <textarea v-model="permissionProfileForm.reason" rows="3" class="rounded-xl border border-slate-300 px-3 py-2"></textarea>
        </label>
        <div class="flex justify-end">
          <button type="button" class="rounded-xl bg-[var(--color-primary)] px-5 py-2 font-semibold text-white" :disabled="saving" @click="savePermissionProfile">Criar perfil</button>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'groups'">
      <section v-if="!groupEditorOpen" class="grid gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-600">Agrupe pessoas que precisam do mesmo perfil e escopo.</p>
          <button type="button" class="rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-white" @click="openAccessGroupCreate">Novo grupo</button>
        </div>
        <div class="grid gap-3 lg:grid-cols-2">
          <article v-for="group in accessGroups" :key="group.id" class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-start justify-between gap-3">
              <div><h2 class="font-semibold text-slate-950">{{ group.label }}</h2><p class="mt-1 text-sm text-slate-600">{{ group.member_count }} pessoa(s)</p></div>
              <StatusBadge :label="group.active ? 'ativo' : 'inativo'" />
            </div>
            <p class="mt-3 text-sm text-slate-700">Perfil: {{ permissionProfiles.find((item) => item.id === group.permission_profile)?.label || 'Nao encontrado' }}</p>
          </article>
          <p v-if="accessGroups.length === 0" class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Nenhum grupo cadastrado.</p>
        </div>
      </section>
      <section v-else class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div><button type="button" class="font-semibold text-[var(--color-primary)]" @click="groupEditorOpen = false">Voltar</button><h2 class="mt-2 text-xl font-semibold">Novo grupo</h2></div>
        <label class="grid gap-1 font-semibold">Nome<input v-model="accessGroupForm.label" class="rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label class="grid gap-1 font-semibold">Perfil de acesso<select v-model="accessGroupForm.permissionProfile" class="rounded-xl border border-slate-300 px-3 py-2"><option value="">Selecione</option><option v-for="profile in permissionProfiles.filter((item) => item.active)" :key="profile.id" :value="profile.id">{{ profile.label }}</option></select></label>
        <label class="grid gap-1 font-semibold">E-mails das pessoas, um por linha<textarea v-model="accessGroupForm.membersText" rows="6" class="rounded-xl border border-slate-300 px-3 py-2"></textarea></label>
        <label class="grid gap-1 font-semibold">Identificador externo opcional<input v-model="accessGroupForm.externalId" class="rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label class="grid gap-1 font-semibold">Motivo<textarea v-model="accessGroupForm.reason" rows="3" class="rounded-xl border border-slate-300 px-3 py-2"></textarea></label>
        <div class="flex justify-end"><button type="button" class="rounded-xl bg-[var(--color-primary)] px-5 py-2 font-semibold text-white" :disabled="saving" @click="saveAccessGroup">Criar grupo</button></div>
      </section>
    </template>

    <template v-else-if="activeTab === 'people'">
      <section v-if="!editorOpen" class="grid gap-3">
        <div class="grid gap-2 border-b border-slate-200 pb-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <input v-model="filters.search" type="search" class="min-h-10 border border-slate-200 px-3 text-sm" placeholder="Buscar nome ou email" @keyup.enter="loadUsers(1)" />
          <select v-model="filters.profile" class="min-h-10 border border-slate-200 px-3 text-sm"><option value="">Todos os perfis</option><option v-for="profile in catalogs.profiles" :key="profile.key" :value="profile.key">{{ profile.label }}</option></select>
          <select v-model="filters.status" class="min-h-10 border border-slate-200 px-3 text-sm"><option value="">Todos os status</option><option value="active">Ativo</option><option value="inactive">Inativo</option></select>
          <input v-model="filters.scope" class="min-h-10 border border-slate-200 px-3 text-sm" placeholder="Filtrar escopo" @keyup.enter="loadUsers(1)" />
          <div class="flex gap-2"><button type="button" class="min-h-10 border border-slate-300 px-3 text-sm font-semibold" @click="loadUsers(1)">Filtrar</button><button type="button" class="min-h-10 bg-[var(--color-primary)] px-4 text-sm font-semibold text-white" @click="openCreate">Novo usuario</button></div>
        </div>
        <section class="overflow-x-auto border border-slate-200 bg-white">
          <div class="min-w-[900px]">
            <div class="grid grid-cols-[1.2fr_1.4fr_1fr_1.5fr_0.7fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500"><span>Nome</span><span>Email</span><span>Perfil</span><span>Escopo</span><span>Status</span><span class="text-right">Acao</span></div>
            <button v-for="user in users" :key="user.id" type="button" class="grid w-full grid-cols-[1.2fr_1.4fr_1fr_1.5fr_0.7fr_0.8fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-slate-50" @click="openEdit(user)"><span class="font-semibold text-slate-950">{{ user.display_name }}</span><span class="truncate text-slate-600">{{ user.email }}</span><span>{{ profileLabel(user.profile_key) }}</span><span class="truncate text-slate-600">{{ scopeLabel(user) }}</span><StatusBadge :label="user.active ? 'ativo' : 'inativo'" /><span class="text-right font-semibold text-[var(--color-primary)]">Editar</span></button>
            <p v-if="users.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">Nenhum usuario encontrado.</p>
          </div>
        </section>
        <div class="flex items-center justify-end gap-3 text-sm"><button type="button" class="border border-slate-200 px-3 py-2 disabled:opacity-40" :disabled="userMeta.page <= 1" @click="loadUsers(userMeta.page - 1)">Anterior</button><span>Pagina {{ userMeta.page }} de {{ totalPages }}</span><button type="button" class="border border-slate-200 px-3 py-2 disabled:opacity-40" :disabled="userMeta.page >= totalPages" @click="loadUsers(userMeta.page + 1)">Proxima</button></div>
      </section>

      <section v-else class="grid gap-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3"><div><button type="button" class="text-sm font-semibold text-[var(--color-primary)]" @click="editorOpen = false">Voltar</button><h2 class="mt-2 text-xl font-semibold text-slate-950">{{ editorMode === 'create' ? 'Cadastrar usuario' : form.displayName }}</h2></div><StatusBadge v-if="editorMode === 'edit'" :label="form.active ? 'ativo' : 'inativo'" /></div>
        <div class="grid gap-4 lg:grid-cols-2">
          <label class="grid gap-1 text-sm font-semibold text-slate-700"><span>Email</span><input v-model="form.email" type="email" :disabled="editorMode === 'edit'" class="min-h-10 border border-slate-200 px-3 disabled:bg-slate-100" /></label>
          <label class="grid gap-1 text-sm font-semibold text-slate-700"><span>Nome</span><input v-model="form.displayName" class="min-h-10 border border-slate-200 px-3" /></label>
          <label class="grid gap-1 text-sm font-semibold text-slate-700"><span>RA</span><input v-model="form.ra" class="min-h-10 border border-slate-200 px-3" /></label>
          <label class="grid gap-1 text-sm font-semibold text-slate-700"><span>Perfil</span><select :value="form.profileKey" class="min-h-10 border border-slate-200 px-3" @change="setProfile(form, $event.target.value)"><option value="">Selecione</option><option v-for="profile in catalogs.profiles" :key="profile.key" :value="profile.key">{{ profile.label }}</option></select></label>
        </div>
        <div v-if="selectedProfile?.scope_key" class="grid gap-2"><p class="text-sm font-semibold text-slate-700">{{ selectedProfile.scope_key }}</p><div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><label v-for="option in scopeOptions" :key="option.value" class="flex min-h-10 items-center justify-between border border-slate-200 px-3 text-sm"><span>{{ option.label }}</span><input type="checkbox" :checked="form.scopes.includes(option.value)" @change="toggleScope(form, option.value, $event.target.checked)" /></label></div><p v-if="scopeOptions.length === 0" class="text-sm text-amber-800">Nenhum valor desse escopo foi encontrado no backend.</p></div>
        <div><p class="text-sm font-semibold text-slate-700">Acoes do perfil</p><div class="mt-2 flex flex-wrap gap-1"><span v-for="action in selectedProfile?.actions || []" :key="action" class="bg-slate-100 px-2 py-1 text-xs text-slate-700">{{ action }}</span></div></div>
        <label v-if="editorMode === 'edit'" class="flex items-center gap-2 text-sm font-semibold text-slate-700"><input v-model="form.active" type="checkbox" />Usuario ativo</label>
        <label class="grid gap-1 text-sm font-semibold text-slate-700"><span>Motivo da alteracao</span><textarea v-model="form.reason" rows="3" class="border border-slate-200 px-3 py-2" placeholder="Obrigatorio para auditoria"></textarea></label>
        <div class="flex justify-end"><button type="button" class="min-h-10 bg-[var(--color-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" @click="saveUser">{{ saving ? 'Salvando...' : 'Salvar' }}</button></div>
        <section v-if="selectedUserAudit.length" class="border-t border-slate-200 pt-4"><h3 class="text-sm font-semibold text-slate-950">Historico recente</h3><div v-for="row in selectedUserAudit" :key="row.id" class="grid gap-1 border-b border-slate-100 py-3 text-sm md:grid-cols-[1fr_1.5fr_1fr]"><span class="font-semibold">{{ row.operation }}</span><span>{{ row.reason }}</span><span class="text-slate-500">{{ formatDate(row.event_at) }}</span></div></section>
      </section>
    </template>

    <template v-else-if="activeTab === 'requests'">
      <section v-if="!selectedRequest" class="grid gap-3">
        <div class="flex flex-col gap-2 border-b border-slate-200 pb-3 md:flex-row"><input v-model="requestFilters.search" type="search" class="min-h-10 flex-1 border border-slate-200 px-3 text-sm" placeholder="Buscar solicitacao" @keyup.enter="loadRequests(1)" /><select v-model="requestFilters.status" class="min-h-10 border border-slate-200 px-3 text-sm"><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Rejeitadas</option><option value="">Todas</option></select><button type="button" class="min-h-10 border border-slate-300 px-4 text-sm font-semibold" @click="loadRequests(1)">Filtrar</button></div>
        <section class="overflow-x-auto border border-slate-200 bg-white"><div class="min-w-[760px]"><div class="grid grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500"><span>Nome</span><span>Email</span><span>Fluxo</span><span>Status</span><span>Ultima tentativa</span></div><button v-for="request in requests" :key="request.id" type="button" class="grid w-full grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_1fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-slate-50" @click="openRequest(request)"><span class="font-semibold">{{ request.display_name }}</span><span class="truncate text-slate-600">{{ request.email }}</span><span>{{ request.identity_flow || 'SSO' }}</span><StatusBadge :label="request.status" /><span class="text-slate-500">{{ formatDate(request.last_seen_at) }}</span></button><p v-if="requests.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">Nenhuma solicitacao encontrada.</p></div></section>
        <div class="flex items-center justify-end gap-3 text-sm"><button type="button" class="border border-slate-200 px-3 py-2 disabled:opacity-40" :disabled="requestMeta.page <= 1" @click="loadRequests(requestMeta.page - 1)">Anterior</button><span>Pagina {{ requestMeta.page }} de {{ requestTotalPages }}</span><button type="button" class="border border-slate-200 px-3 py-2 disabled:opacity-40" :disabled="requestMeta.page >= requestTotalPages" @click="loadRequests(requestMeta.page + 1)">Proxima</button></div>
      </section>
      <section v-else class="grid gap-4"><div class="border-b border-slate-200 pb-3"><button type="button" class="text-sm font-semibold text-[var(--color-primary)]" @click="selectedRequest = null">Voltar</button><h2 class="mt-2 text-xl font-semibold text-slate-950">{{ selectedRequest.display_name }}</h2><p class="text-sm text-slate-600">{{ selectedRequest.email }} - {{ selectedRequest.attempt_count }} tentativa(s)</p></div><div class="grid gap-4 lg:grid-cols-2"><label class="grid gap-1 text-sm font-semibold"><span>Nome</span><input v-model="approval.displayName" class="min-h-10 border border-slate-200 px-3" /></label><label class="grid gap-1 text-sm font-semibold"><span>RA</span><input v-model="approval.ra" class="min-h-10 border border-slate-200 px-3" /></label><label class="grid gap-1 text-sm font-semibold"><span>Perfil</span><select :value="approval.profileKey" class="min-h-10 border border-slate-200 px-3" @change="setProfile(approval, $event.target.value)"><option value="">Selecione</option><option v-for="profile in catalogs.profiles" :key="profile.key" :value="profile.key">{{ profile.label }}</option></select></label></div><div v-if="selectedApprovalProfile?.scope_key" class="grid gap-2"><p class="text-sm font-semibold">{{ selectedApprovalProfile.scope_key }}</p><div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><label v-for="option in approvalScopeOptions" :key="option.value" class="flex min-h-10 items-center justify-between border border-slate-200 px-3 text-sm"><span>{{ option.label }}</span><input type="checkbox" :checked="approval.scopes.includes(option.value)" @change="toggleScope(approval, option.value, $event.target.checked)" /></label></div></div><label class="grid gap-1 text-sm font-semibold"><span>Motivo da decisao</span><textarea v-model="approval.reason" rows="3" class="border border-slate-200 px-3 py-2"></textarea></label><div class="flex justify-end gap-2"><button type="button" class="min-h-10 border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50" :disabled="saving" @click="rejectRequest">Rejeitar</button><button type="button" class="min-h-10 bg-[var(--color-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" @click="approveRequest">Aprovar acesso</button></div></section>
    </template>

    <template v-else>
      <div class="flex justify-end"><button type="button" class="min-h-10 border border-slate-300 px-4 text-sm font-semibold" @click="loadAudit">Atualizar</button></div>
      <section class="overflow-x-auto border border-slate-200 bg-white"><div class="min-w-[900px]"><div class="grid grid-cols-[1.2fr_1.2fr_1fr_1.5fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500"><span>Ator</span><span>Usuario</span><span>Operacao</span><span>Motivo</span><span>Data</span></div><div v-for="row in auditRows" :key="row.id" class="grid grid-cols-[1.2fr_1.2fr_1fr_1.5fr_1fr] gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-0"><span class="truncate">{{ row.actor_email }}</span><span class="truncate">{{ row.target_email }}</span><span class="font-semibold">{{ row.operation }}</span><span>{{ row.reason }}</span><span class="text-slate-500">{{ formatDate(row.event_at) }}</span></div><p v-if="auditRows.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">Nenhum evento de autorizacao registrado.</p></div></section>
    </template>
  </div>
</template>
