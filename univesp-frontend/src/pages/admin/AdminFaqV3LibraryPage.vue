<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  archiveKnowledgeV3Bundle,
  createProfileAssignment,
  createKnowledgeV3Bundle,
  deleteKnowledgeV3Bundle,
  getKnowledgeV3Bundle,
  getKnowledgeV3Catalogs,
  listAccessGroups,
  listAdminUsers,
  listKnowledgeV3Bundles,
  listPermissionProfiles,
  listProfileAssignments,
  revokeProfileAssignment,
  unarchiveKnowledgeV3Bundle,
} from '@/services/appApi'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const rows = ref([])
const catalogs = reactive({ themes: [], routing_patterns: [] })
const grantCatalogs = reactive({
  users: [],
  groups: [],
  profiles: [],
  allProfiles: [],
  assignments: [],
})
const filters = reactive({ search: '', status: 'active', audience: '' })
const createForm = reactive({
  title: '',
  bundle_key: '',
  theme_key: '',
  audience_profile: 'student',
})
const grantForm = reactive({
  subject_type: 'person',
  subject_id: '',
  permission_profile: '',
  theme_keys: [],
  valid_from: '',
  valid_until: '',
  justification: '',
})

const audienceLabels = {
  student: 'Aluno',
  public: 'Público externo',
  mixed: 'Mista',
  internal: 'Interna',
}
const layerLabels = {
  student: 'Aluno',
  public: 'Público',
  internal: 'Interno',
}

const filteredRows = computed(() => {
  const term = normalize(filters.search)
  return rows.value.filter((row) => {
    if (filters.audience && row.audience_profile !== filters.audience) return false
    if (!term) return true
    return normalize(`${row.title} ${row.bundle_key} ${row.theme_key}`).includes(term)
  })
})

const summary = computed(() => ({
  total: rows.value.length,
  drafts: rows.value.filter((row) => row.draft_summary?.lifecycle_state === 'draft').length,
  review: rows.value.filter(
    (row) => row.draft_summary?.lifecycle_state === 'pending_approval',
  ).length,
  published: rows.value.filter((row) => Boolean(row.published_version)).length,
}))

onMounted(loadLibrary)

async function loadLibrary() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [bundleResponse, catalogResponse] = await Promise.all([
      listKnowledgeV3Bundles({ status: filters.status, page_size: 100 }),
      getKnowledgeV3Catalogs(),
    ])
    rows.value = bundleResponse.data || []
    Object.assign(catalogs, catalogResponse.data || {})
    if (!createForm.theme_key && catalogs.themes.length) {
      createForm.theme_key = catalogs.themes[0].theme_key
    }
    await loadGrantCatalogs()
  } catch (error) {
    errorMessage.value =
      error?.message || 'Não foi possível carregar os fluxos. Tente novamente.'
  } finally {
    loading.value = false
  }
}

async function loadGrantCatalogs() {
  try {
    const [usersResponse, groupsResponse, profilesResponse, assignmentsResponse] =
      await Promise.all([
        listAdminUsers({ page_size: 200 }),
        listAccessGroups(),
        listPermissionProfiles(),
        listProfileAssignments(),
      ])
    grantCatalogs.users = usersResponse.data || []
    grantCatalogs.groups = groupsResponse.data || []
    grantCatalogs.allProfiles = profilesResponse.data || []
    grantCatalogs.profiles = grantCatalogs.allProfiles.filter(
      (profile) =>
        profile.capabilities?.includes('suggest_knowledge') &&
        ['op', 'op_externo'].includes(profile.base_persona),
    )
    grantCatalogs.assignments = assignmentsResponse.data || []
    if (!grantForm.permission_profile && grantCatalogs.profiles.length) {
      grantForm.permission_profile = grantCatalogs.profiles[0].id
    }
  } catch {
    grantCatalogs.users = []
    grantCatalogs.groups = []
    grantCatalogs.profiles = []
    grantCatalogs.assignments = []
  }
}

const grantSubjects = computed(() =>
  grantForm.subject_type === 'group'
    ? grantCatalogs.groups.map((group) => ({
        value: group.id,
        label: group.label,
        base_persona: grantCatalogs.allProfiles.find(
          (profile) => profile.id === group.permission_profile,
        )?.base_persona,
      }))
    : grantCatalogs.users
        .filter((user) => ['op', 'op_externo'].includes(user.profile_key))
        .map((user) => ({
          value: user.email,
          label: `${user.display_name || user.email} · ${user.profile_key === 'op_externo' ? 'BPO' : 'OP'}`,
          base_persona: user.profile_key,
        })),
)

const eligibleGrantProfiles = computed(() => {
  const selected = grantSubjects.value.find((item) => item.value === grantForm.subject_id)
  return selected
    ? grantCatalogs.profiles.filter((profile) => profile.base_persona === selected.base_persona)
    : grantCatalogs.profiles
})
const contributorAssignments = computed(() => {
  const profileIds = new Set(grantCatalogs.profiles.map((profile) => profile.id))
  return grantCatalogs.assignments.filter((assignment) =>
    profileIds.has(assignment.permission_profile),
  )
})

async function createFlow() {
  if (saving.value) return
  const title = createForm.title.trim()
  const bundleKey = (createForm.bundle_key.trim() || slug(title)).slice(0, 120)
  if (!title || !bundleKey || !createForm.theme_key) {
    errorMessage.value = 'Informe nome, chave e tema para criar o fluxo.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const payload = initialPayload({
      bundleKey,
      themeKey: createForm.theme_key,
      title,
      audience: createForm.audience_profile,
      patternKey: catalogs.routing_patterns[0]?.pattern_key || 'op_then_area',
    })
    await createKnowledgeV3Bundle({
      bundle_key: bundleKey,
      title,
      theme_key: createForm.theme_key,
      audience_profile: createForm.audience_profile,
      payload,
    })
    await openEditor(bundleKey)
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível criar o fluxo.'
  } finally {
    saving.value = false
  }
}

async function grantSuggestionAccess() {
  if (
    !grantForm.subject_id ||
    !grantForm.permission_profile ||
    !grantForm.theme_keys.length ||
    grantForm.justification.trim().length < 5
  ) {
    errorMessage.value = 'Selecione pessoa/grupo, temas e informe uma justificativa.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await createProfileAssignment({
      subject_type: grantForm.subject_type,
      subject_id: grantForm.subject_id,
      permission_profile: grantForm.permission_profile,
      scopes: { knowledge_themes: grantForm.theme_keys },
      valid_from: grantForm.valid_from || null,
      valid_until: grantForm.valid_until || null,
      reason: grantForm.justification.trim(),
    })
    successMessage.value = 'Permissão para sugerir concedida no escopo e período informados.'
    Object.assign(grantForm, {
      subject_id: '',
      theme_keys: [],
      valid_from: '',
      valid_until: '',
      justification: '',
    })
    grantCatalogs.assignments = (await listProfileAssignments()).data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível conceder a permissão.'
  } finally {
    saving.value = false
  }
}

async function revokeSuggestionAccess(assignment) {
  if (!window.confirm(`Revogar a permissão de ${assignment.subject_id}?`)) return
  try {
    await revokeProfileAssignment(assignment.id)
    successMessage.value = 'Permissão revogada.'
    grantCatalogs.assignments = (await listProfileAssignments()).data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível revogar a permissão.'
  }
}

function onGrantSubjectChange() {
  const first = eligibleGrantProfiles.value[0]
  grantForm.permission_profile = first?.id || ''
}

async function duplicateFlow(row) {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const source = (await getKnowledgeV3Bundle(row.bundle_key)).data
    const sourcePayload = cloneJson(
      source.draft?.payload || source.published?.payload || initialPayload({
        bundleKey: row.bundle_key,
        themeKey: row.theme_key,
        title: row.title,
        audience: row.audience_profile,
        patternKey: catalogs.routing_patterns[0]?.pattern_key || 'op_then_area',
      }),
    )
    const suffix = Date.now().toString().slice(-6)
    const bundleKey = `${row.bundle_key}-copia-${suffix}`.slice(0, 120)
    sourcePayload.bundle_key = bundleKey
    sourcePayload.metadata = {
      ...(sourcePayload.metadata || {}),
      title: `Cópia de ${row.title}`,
    }
    await createKnowledgeV3Bundle({
      bundle_key: bundleKey,
      title: `Cópia de ${row.title}`,
      theme_key: row.theme_key,
      audience_profile: row.audience_profile,
      payload: sourcePayload,
    })
    await openEditor(bundleKey)
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível duplicar o fluxo.'
  } finally {
    saving.value = false
  }
}

async function archiveFlow(row) {
  if (!window.confirm(`Arquivar o fluxo “${row.title}”?`)) return
  await runRowAction(
    () => archiveKnowledgeV3Bundle(row.bundle_key),
    'Fluxo arquivado.',
  )
}

async function restoreFlow(row) {
  await runRowAction(
    () => unarchiveKnowledgeV3Bundle(row.bundle_key),
    'Fluxo restaurado.',
  )
}

async function deleteFlow(row) {
  if (
    !window.confirm(
      `Excluir definitivamente o rascunho “${row.title}”? Esta ação só é permitida quando nunca houve publicação.`,
    )
  ) {
    return
  }
  await runRowAction(
    () => deleteKnowledgeV3Bundle(row.bundle_key),
    'Rascunho excluído.',
  )
}

async function runRowAction(action, message) {
  errorMessage.value = ''
  try {
    await action()
    successMessage.value = message
    await loadLibrary()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível concluir a ação.'
  }
}

function openEditor(bundleKey) {
  return router.push({
    name: 'admin-faq-builder',
    params: { bundleId: bundleKey },
  })
}

function lifecycleLabel(row) {
  if (row.status === 'archived') return 'Arquivado'
  const state = row.draft_summary?.lifecycle_state
  if (state === 'pending_approval') return 'Aguardando aprovação'
  if (state === 'approved') return 'Aprovado'
  if (state === 'rejected') return 'Ajustes solicitados'
  if (state === 'draft') return 'Rascunho'
  return row.published_version ? 'Publicado' : 'Rascunho'
}

function validityLabel(row) {
  const version = row.published_summary || row.draft_summary
  if (!version?.valid_from && !version?.valid_until) return 'Sem prazo definido'
  if (version.valid_from && version.valid_until) {
    return `${formatDate(version.valid_from)} a ${formatDate(version.valid_until)}`
  }
  if (version.valid_from) return `Vigente desde ${formatDate(version.valid_from)}`
  return `Vigente até ${formatDate(version.valid_until)}`
}

function initialPayload({ bundleKey, themeKey, title, audience, patternKey }) {
  const audiences =
    audience === 'mixed'
      ? ['student', 'public']
      : audience === 'internal'
        ? ['internal']
        : [audience]
  const rootId = `${bundleKey}-inicio`
  return {
    schema_version: '3.0.0',
    bundle_key: bundleKey,
    theme_key: themeKey,
    metadata: {
      title,
      audience_profile: audience,
      operational_owner: {
        owner_type: 'queue',
        owner_key: 'atendimento-geral',
      },
      criticidade_default_key: 'media',
      sla_policy_key: '48h',
    },
    graph: {
      student_root_node_id: audiences.includes('student') ? rootId : null,
      public_root_node_id: audiences.includes('public') ? rootId : null,
      internal_root_node_id: audiences.includes('internal') ? rootId : null,
    },
    routing_policy: {
      pattern_key: patternKey,
      bpo_enabled: patternKey.includes('bpo'),
      institutional_exceptions: ['provas', 'critica'],
    },
    nodes: [
      {
        node_id: rootId,
        stable_key: rootId,
        node_kind: 'path',
        audiences,
        display: { title: 'Início' },
        content: {
          student: audiences.includes('student') ? { blocks: [] } : null,
          public: audiences.includes('public') ? { blocks: [] } : null,
        },
        playbooks: { op: null, bpo: null, analyst: null },
        operational: {
          routing_override: null,
          criticidade: null,
          sla_policy_key: null,
        },
        document_policy: null,
        media_refs: [],
      },
    ],
    edges: [],
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}
</script>

<template>
  <main class="crm-page-wide crm-content-stack" aria-labelledby="faq-library-title">
    <header class="crm-page-header">
      <div>
        <p class="faq-kicker">FAQs e orientações</p>
        <h1 id="faq-library-title" class="crm-page-title">Biblioteca de fluxos</h1>
        <p class="crm-page-description">
          Crie e mantenha a orientação do aluno e os playbooks da operação no mesmo fluxo.
        </p>
      </div>
    </header>

    <p v-if="errorMessage" class="crm-alert crm-alert--danger" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="crm-alert crm-alert--success" role="status">
      {{ successMessage }}
    </p>

    <section class="crm-panel" aria-labelledby="faq-summary-title">
      <div class="crm-panel-header">
        <div class="crm-panel-header__copy">
          <h2 id="faq-summary-title">Visão da biblioteca</h2>
          <p>O estado mostra o próximo passo editorial de cada fluxo.</p>
        </div>
      </div>
      <div class="crm-stat-grid">
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Fluxos</p>
          <p class="crm-stat-tile__value">{{ summary.total }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Rascunhos</p>
          <p class="crm-stat-tile__value">{{ summary.drafts }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Aguardando aprovação</p>
          <p class="crm-stat-tile__value">{{ summary.review }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Com versão publicada</p>
          <p class="crm-stat-tile__value">{{ summary.published }}</p>
        </div>
      </div>
    </section>

    <section class="crm-panel" aria-labelledby="create-flow-title">
      <div class="crm-panel-header">
        <div class="crm-panel-header__copy">
          <h2 id="create-flow-title">Criar fluxo</h2>
          <p>Comece pelo tema e pelo público. As orientações operacionais ficam no Editor.</p>
        </div>
      </div>
      <form class="crm-form-grid" @submit.prevent="createFlow">
        <label class="crm-field-label">
          Nome do fluxo
          <input v-model="createForm.title" class="crm-field" required />
        </label>
        <label class="crm-field-label">
          Chave estável
          <input
            v-model="createForm.bundle_key"
            class="crm-field"
            :placeholder="slug(createForm.title) || 'acesso-ava'"
          />
        </label>
        <label class="crm-field-label">
          Tema
          <select v-model="createForm.theme_key" class="crm-field" required>
            <option
              v-for="theme in catalogs.themes"
              :key="theme.theme_key"
              :value="theme.theme_key"
            >
              {{ theme.theme_label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Tipo de FAQ
          <select v-model="createForm.audience_profile" class="crm-field">
            <option
              v-for="(label, value) in audienceLabels"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
        </label>
        <div class="crm-form-actions">
          <button class="crm-button-primary" type="submit" :disabled="saving">
            {{ saving ? 'Criando…' : 'Criar e abrir Editor' }}
          </button>
        </div>
      </form>
    </section>

    <details class="crm-panel faq-grants">
      <summary>Quem pode sugerir melhorias</summary>
      <p>
        OP e BPO só veem o botão de sugestão quando recebem esta permissão para os
        temas e o período definidos.
      </p>
      <form
        v-if="grantCatalogs.profiles.length"
        class="crm-form-grid faq-grants__form"
        @submit.prevent="grantSuggestionAccess"
      >
        <label class="crm-field-label">
          Conceder para
          <select
            v-model="grantForm.subject_type"
            class="crm-field"
            @change="grantForm.subject_id = ''; onGrantSubjectChange()"
          >
            <option value="person">Uma pessoa</option>
            <option value="group">Um grupo</option>
          </select>
        </label>
        <label class="crm-field-label">
          Pessoa ou grupo
          <select
            v-model="grantForm.subject_id"
            class="crm-field"
            required
            @change="onGrantSubjectChange"
          >
            <option value="">Selecione</option>
            <option
              v-for="subject in grantSubjects"
              :key="subject.value"
              :value="subject.value"
            >
              {{ subject.label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Perfil
          <select v-model="grantForm.permission_profile" class="crm-field" required>
            <option
              v-for="profile in eligibleGrantProfiles"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.label }}
            </option>
          </select>
        </label>
        <fieldset class="faq-grants__themes">
          <legend>Temas permitidos</legend>
          <label v-for="theme in catalogs.themes" :key="theme.theme_key">
            <input
              v-model="grantForm.theme_keys"
              type="checkbox"
              :value="theme.theme_key"
            />
            {{ theme.theme_label }}
          </label>
        </fieldset>
        <label class="crm-field-label">
          Válido a partir de
          <input v-model="grantForm.valid_from" type="datetime-local" class="crm-field" />
        </label>
        <label class="crm-field-label">
          Válido até
          <input v-model="grantForm.valid_until" type="datetime-local" class="crm-field" />
        </label>
        <label class="crm-field-label faq-grants__reason">
          Justificativa
          <input
            v-model="grantForm.justification"
            class="crm-field"
            placeholder="Por que esta pessoa ou grupo deve sugerir?"
            required
          />
        </label>
        <div class="crm-form-actions">
          <button type="submit" class="crm-button-primary" :disabled="saving">
            Conceder permissão
          </button>
        </div>
      </form>
      <p v-else>
        Os perfis de contribuição ainda não foram sincronizados neste ambiente.
      </p>

      <div v-if="contributorAssignments.length" class="crm-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pessoa ou grupo</th>
              <th>Temas</th>
              <th>Validade</th>
              <th>Situação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="assignment in contributorAssignments" :key="assignment.id">
              <td>{{ assignment.subject_id }}</td>
              <td>{{ assignment.scopes?.knowledge_themes?.join(', ') || '—' }}</td>
              <td>
                {{ assignment.valid_from ? formatDate(assignment.valid_from) : 'Agora' }}
                a
                {{ assignment.valid_until ? formatDate(assignment.valid_until) : 'Sem prazo final' }}
              </td>
              <td>{{ assignment.active ? 'Ativa' : 'Revogada' }}</td>
              <td>
                <button
                  v-if="assignment.active"
                  type="button"
                  class="crm-button-secondary"
                  @click="revokeSuggestionAccess(assignment)"
                >
                  Revogar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <section class="crm-panel" aria-labelledby="available-flows-title">
      <div class="crm-panel-header">
        <div class="crm-panel-header__copy">
          <h2 id="available-flows-title">Fluxos disponíveis</h2>
          <p>Abra um fluxo para editar conteúdo, playbooks, vigência e aprovação.</p>
        </div>
      </div>

      <div class="crm-filter-grid">
        <label class="crm-field-label">
          Buscar
          <input
            v-model="filters.search"
            class="crm-field"
            placeholder="Tema, chave ou responsável"
          />
        </label>
        <label class="crm-field-label">
          Situação
          <select v-model="filters.status" class="crm-field" @change="loadLibrary">
            <option value="active">Ativos</option>
            <option value="archived">Arquivados</option>
          </select>
        </label>
        <label class="crm-field-label">
          Tipo de FAQ
          <select v-model="filters.audience" class="crm-field">
            <option value="">Todos</option>
            <option
              v-for="(label, value) in audienceLabels"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="loading" role="status">Carregando fluxos…</p>
      <div v-else class="crm-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Tipo de FAQ</th>
              <th scope="col">Públicos</th>
              <th scope="col">Playbooks</th>
              <th scope="col">Responsável</th>
              <th scope="col">Situação</th>
              <th scope="col">Vigência</th>
              <th scope="col">Última atualização</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.bundle_key">
              <td>
                <strong>{{ row.title }}</strong>
                <small class="crm-table-secondary">{{ row.theme_key }}</small>
              </td>
              <td>{{ audienceLabels[row.audience_profile] || row.audience_profile }}</td>
              <td>
                <span
                  v-for="audience in row.audiences"
                  :key="audience"
                  class="crm-chip"
                >
                  {{ layerLabels[audience] || audience }}
                </span>
              </td>
              <td>
                OP {{ row.playbook_summary?.op ? 'sim' : '—' }} ·
                BPO {{ row.playbook_summary?.bpo ? 'sim' : '—' }} ·
                Analista {{ row.playbook_summary?.analyst ? 'sim' : '—' }}
              </td>
              <td>{{ row.owner_email || 'Não definido' }}</td>
              <td>{{ lifecycleLabel(row) }}</td>
              <td>{{ validityLabel(row) }}</td>
              <td>{{ formatDate(row.modified) }}</td>
              <td>
                <div class="crm-inline-actions">
                  <button
                    type="button"
                    class="crm-button-secondary"
                    @click="openEditor(row.bundle_key)"
                  >
                    Abrir
                  </button>
                  <button
                    v-if="row.status !== 'archived'"
                    type="button"
                    class="crm-button-secondary"
                    @click="duplicateFlow(row)"
                  >
                    Duplicar
                  </button>
                  <button
                    v-if="row.status === 'archived'"
                    type="button"
                    class="crm-button-secondary"
                    @click="restoreFlow(row)"
                  >
                    Restaurar
                  </button>
                  <button
                    v-else-if="row.published_version"
                    type="button"
                    class="crm-button-secondary"
                    @click="archiveFlow(row)"
                  >
                    Arquivar
                  </button>
                  <button
                    v-else
                    type="button"
                    class="crm-button-secondary"
                    @click="deleteFlow(row)"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="9">Nenhum fluxo encontrado com estes filtros.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.crm-panel {
  padding: var(--space-4);
}

.faq-kicker {
  color: var(--color-primary-dark);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.crm-alert {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.crm-alert--danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.crm-alert--success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.crm-form-actions {
  display: flex;
  align-items: end;
}

.faq-grants > summary {
  cursor: pointer;
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.faq-grants > p,
.faq-grants__form,
.faq-grants .crm-table-scroll {
  margin-top: var(--space-3);
}

.faq-grants__themes {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faq-grants__themes legend {
  padding-inline: var(--space-1);
  font-weight: 700;
}

.faq-grants__themes label {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.faq-grants__reason {
  grid-column: span 2;
}

.crm-table-secondary {
  display: block;
  margin-top: 0.25rem;
}

.crm-inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.crm-table-scroll table {
  min-width: 72rem;
}

@media (max-width: 48rem) {
  .faq-grants__reason {
    grid-column: auto;
  }
}
</style>
