<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  archiveKnowledgeV3Bundle,
  createKnowledgeV3Bundle,
  createKnowledgeV3Theme,
  deleteKnowledgeV3Bundle,
  getKnowledgeV3Bundle,
  getKnowledgeV3Catalogs,
  listAccessGroups,
  listKnowledgeV3Bundles,
  unarchiveKnowledgeV3Bundle,
} from '@/services/appApi'
import {
  audienceProfileFromChannels,
  availableChannelLabels,
  buildInitialUnifiedPayload,
  channelsFromPayload,
} from '@/services/faqV3PayloadAdapter.js'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const rows = ref([])
const accessGroups = ref([])
const catalogs = reactive({ themes: [], routing_patterns: [] })
const filters = reactive({ search: '', status: 'active', audience: '' })
const createModalOpen = ref(false)
const themeModalOpen = ref(false)
const themeSearch = ref('')
const bundleKeyTouched = ref(false)
const areaKeyTouched = ref(false)
const createForm = reactive({
  title: '',
  bundle_key: '',
  theme_key: '',
  availableStudent: true,
  availablePublic: false,
  owner_email: '',
  pattern_key: '',
})
const themeForm = reactive({
  theme_label: '',
  theme_key: '',
  area_label: '',
  area_key: '',
  owner_email: '',
  approver_group: '',
})

const availabilityFilterLabels = {
  student: 'Portal do Aluno',
  public: 'Atendimento público',
  mixed: 'Portal do Aluno e Atendimento público',
}
const layerLabels = {
  student: 'Aluno',
  public: 'Público',
  internal: 'Interno',
}

const filteredThemes = computed(() => {
  const term = normalize(themeSearch.value)
  if (!term) return catalogs.themes
  return catalogs.themes.filter((theme) =>
    normalize(`${theme.theme_label} ${theme.theme_key}`).includes(term),
  )
})

const selectedTheme = computed(
  () => catalogs.themes.find((theme) => theme.theme_key === createForm.theme_key) || null,
)

const filteredRows = computed(() => {
  const term = normalize(filters.search)
  return rows.value.filter((row) => {
    if (filters.audience && row.audience_profile !== filters.audience) return false
    if (!term) return true
    return normalize(
      `${row.title} ${row.bundle_key} ${row.theme_key} ${row.owner_email}`,
    ).includes(term)
  })
})

const hasActiveFilters = computed(
  () => Boolean(normalize(filters.search) || filters.audience || filters.status === 'archived'),
)

const summary = computed(() => ({
  total: rows.value.length,
  drafts: rows.value.filter((row) => row.draft_summary?.lifecycle_state === 'draft').length,
  review: rows.value.filter(
    (row) => row.draft_summary?.lifecycle_state === 'pending_approval',
  ).length,
  published: rows.value.filter((row) => Boolean(row.published_version)).length,
}))

watch(
  () => createForm.theme_key,
  (key) => {
    const theme = catalogs.themes.find((item) => item.theme_key === key)
    if (theme) {
      createForm.owner_email = theme.owner_email || ''
      themeSearch.value = theme.theme_label
    }
  },
)

watch(
  () => createForm.title,
  (title) => {
    if (!bundleKeyTouched.value) {
      createForm.bundle_key = slug(title).slice(0, 120)
    }
  },
)

watch(
  () => themeForm.theme_label,
  (label) => {
    themeForm.theme_key = slug(label).slice(0, 120)
  },
)

watch(
  () => themeForm.area_label,
  (label) => {
    if (!areaKeyTouched.value) {
      themeForm.area_key = slug(label).slice(0, 120)
    }
  },
)

onMounted(loadLibrary)

async function loadLibrary() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [bundleResponse, catalogResponse, groupsResponse] = await Promise.all([
      listKnowledgeV3Bundles({ status: filters.status, page_size: 100 }),
      getKnowledgeV3Catalogs(),
      listAccessGroups(),
    ])
    rows.value = bundleResponse.data || []
    Object.assign(catalogs, catalogResponse.data || {})
    accessGroups.value = groupsResponse.data || []
  } catch (error) {
    errorMessage.value =
      error?.message || 'Não foi possível carregar os fluxos. Tente novamente.'
  } finally {
    loading.value = false
  }
}

async function refreshCatalogs() {
  const catalogResponse = await getKnowledgeV3Catalogs()
  Object.assign(catalogs, catalogResponse.data || {})
}

function resetCreateForm() {
  bundleKeyTouched.value = false
  Object.assign(createForm, {
    title: '',
    bundle_key: '',
    theme_key: catalogs.themes[0]?.theme_key || '',
    availableStudent: true,
    availablePublic: false,
    owner_email: catalogs.themes[0]?.owner_email || '',
    pattern_key: catalogs.routing_patterns[0]?.pattern_key || 'op_then_area',
  })
  themeSearch.value = selectedTheme.value?.theme_label || ''
}

function openCreateModal() {
  errorMessage.value = ''
  resetCreateForm()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
}

function onAreaKeyInput() {
  areaKeyTouched.value = true
}

function openThemeModal() {
  errorMessage.value = ''
  areaKeyTouched.value = false
  Object.assign(themeForm, {
    theme_label: '',
    theme_key: '',
    area_label: '',
    area_key: '',
    owner_email: '',
    approver_group: '',
  })
  themeModalOpen.value = true
}

function closeThemeModal() {
  themeModalOpen.value = false
}

function onBundleKeyInput() {
  bundleKeyTouched.value = true
}

function availabilityChips(audienceProfile) {
  const flags = channelsFromPayload(null, audienceProfile)
  return availableChannelLabels(flags)
}

async function createFlow() {
  if (saving.value) return
  const title = createForm.title.trim()
  const bundleKey = (createForm.bundle_key.trim() || slug(title)).slice(0, 120)
  if (!title || !bundleKey || !createForm.theme_key) {
    errorMessage.value = 'Informe nome e tema para criar o fluxo.'
    return
  }
  if (!createForm.availableStudent && !createForm.availablePublic) {
    errorMessage.value = 'Selecione ao menos um canal: Portal do Aluno ou Atendimento público.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const audienceProfile = audienceProfileFromChannels({
      availableStudent: createForm.availableStudent,
      availablePublic: createForm.availablePublic,
    })
    const payload = buildInitialUnifiedPayload({
      bundleKey,
      themeKey: createForm.theme_key,
      title,
      availableStudent: createForm.availableStudent,
      availablePublic: createForm.availablePublic,
      patternKey: createForm.pattern_key || catalogs.routing_patterns[0]?.pattern_key || 'op_then_area',
    })
    await createKnowledgeV3Bundle({
      bundle_key: bundleKey,
      title,
      theme_key: createForm.theme_key,
      audience_profile: audienceProfile,
      payload,
    })
    createModalOpen.value = false
    await openEditor(bundleKey)
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível criar o fluxo.'
  } finally {
    saving.value = false
  }
}

async function createTheme() {
  if (saving.value) return
  const themeLabel = themeForm.theme_label.trim()
  const themeKey = (themeForm.theme_key.trim() || slug(themeLabel)).slice(0, 120)
  const areaLabel = themeForm.area_label.trim()
  const areaKey = (themeForm.area_key.trim() || slug(areaLabel || 'geral')).slice(0, 120)
  const ownerEmail = themeForm.owner_email.trim()
  if (!themeLabel || !themeKey || !areaLabel || !areaKey || !ownerEmail) {
    errorMessage.value = 'Informe nome, área e responsável para criar o tema.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await createKnowledgeV3Theme({
      theme_label: themeLabel,
      theme_key: themeKey,
      area_label: areaLabel,
      area_key: areaKey,
      owner_email: ownerEmail,
      approver_group: themeForm.approver_group.trim() || undefined,
    })
    await refreshCatalogs()
    createForm.theme_key = response.data?.theme_key || themeKey
    themeSearch.value = response.data?.theme_label || themeLabel
    themeModalOpen.value = false
    successMessage.value = `Tema “${response.data?.theme_label || themeLabel}” criado.`
    if (createModalOpen.value) {
      createForm.owner_email = response.data?.owner_email || ownerEmail
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível criar o tema.'
  } finally {
    saving.value = false
  }
}

async function duplicateFlow(row) {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const source = (await getKnowledgeV3Bundle(row.bundle_key)).data
    const channelFlags = channelsFromPayload(null, row.audience_profile)
    const sourcePayload = cloneJson(
      source.draft?.payload ||
        source.published?.payload ||
        buildInitialUnifiedPayload({
          bundleKey: row.bundle_key,
          themeKey: row.theme_key,
          title: row.title,
          availableStudent: channelFlags.availableStudent,
          availablePublic: channelFlags.availablePublic,
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

async function clearFilters() {
  const shouldReload = filters.status !== 'active'
  Object.assign(filters, { search: '', status: 'active', audience: '' })
  if (shouldReload) await loadLibrary()
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
  <main class="crm-page-wide crm-content-stack crm-page-container" aria-labelledby="faq-library-title">
    <header class="crm-page-header">
      <div>
        <p class="faq-kicker">FAQs e orientações</p>
        <h1 id="faq-library-title" class="crm-page-title">Biblioteca de fluxos</h1>
        <p class="crm-page-description">
          Crie e mantenha a orientação do aluno e os playbooks da operação no mesmo fluxo.
        </p>
      </div>
      <div class="crm-page-header__actions">
        <button type="button" class="crm-button-secondary" @click="openThemeModal">
          Criar novo tema
        </button>
        <button type="button" class="crm-button-primary" @click="openCreateModal">
          Criar fluxo
        </button>
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
          Disponível em
          <select v-model="filters.audience" class="crm-field">
            <option value="">Todos</option>
            <option
              v-for="(label, value) in availabilityFilterLabels"
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
              <th scope="col">Disponível em</th>
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
              <td>
                <span
                  v-for="label in availabilityChips(row.audience_profile)"
                  :key="label"
                  class="crm-chip"
                >
                  {{ label }}
                </span>
              </td>
              <td>
                <span
                  v-for="audience in row.audiences || []"
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
              <td colspan="9">
                <div class="faq-library-empty">
                  <strong>
                    {{ rows.length ? 'Nenhum fluxo encontrado com estes filtros.' : 'Nenhum fluxo disponível nesta visão.' }}
                  </strong>
                  <p v-if="rows.length && hasActiveFilters">
                    Ajuste os filtros ou limpe a busca para ver outros fluxos.
                  </p>
                  <button
                    v-if="hasActiveFilters"
                    type="button"
                    class="crm-button-secondary"
                    @click="clearFilters"
                  >
                    Limpar filtros
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="createModalOpen"
      class="faq-library-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-flow-modal-title"
    >
      <div class="faq-library-modal__backdrop" @click="closeCreateModal" />
      <section class="faq-library-modal__panel crm-panel">
        <header class="faq-library-modal__header">
          <div>
            <h2 id="create-flow-modal-title">Criar fluxo</h2>
            <p>Comece pelo tema e pelos canais. As orientações operacionais ficam no Editor.</p>
          </div>
          <button type="button" class="crm-button-secondary" @click="closeCreateModal">
            Fechar
          </button>
        </header>

        <form class="faq-library-modal__form" @submit.prevent="createFlow">
          <label class="crm-field-label">
            Nome do fluxo
            <input v-model="createForm.title" class="crm-field" required />
          </label>

          <div class="faq-library-modal__theme">
            <label class="crm-field-label">
              Buscar tema
              <input
                v-model="themeSearch"
                class="crm-field"
                type="search"
                placeholder="Digite para filtrar…"
                autocomplete="off"
              />
            </label>
            <label class="crm-field-label">
              Tema
              <select v-model="createForm.theme_key" class="crm-field" required>
                <option value="">Selecione um tema</option>
                <option
                  v-for="theme in filteredThemes"
                  :key="theme.theme_key"
                  :value="theme.theme_key"
                >
                  {{ theme.theme_label }}
                </option>
              </select>
            </label>
            <button
              type="button"
              class="crm-button-secondary faq-library-modal__theme-action"
              @click="openThemeModal"
            >
              Criar novo tema
            </button>
          </div>

          <fieldset class="faq-library-modal__channels">
            <legend class="crm-field-label">Disponível em</legend>
            <label>
              <input v-model="createForm.availableStudent" type="checkbox" />
              Portal do Aluno
            </label>
            <label>
              <input v-model="createForm.availablePublic" type="checkbox" />
              Atendimento público
            </label>
            <p class="faq-library-modal__hint">
              Selecione ao menos um canal.
            </p>
          </fieldset>

          <label class="crm-field-label">
            Responsável operacional
            <input
              v-model="createForm.owner_email"
              class="crm-field"
              type="email"
              :placeholder="selectedTheme?.owner_email || 'E-mail do responsável'"
            />
          </label>

          <label class="crm-field-label">
            Rota inicial
            <select v-model="createForm.pattern_key" class="crm-field" required>
              <option
                v-for="pattern in catalogs.routing_patterns"
                :key="pattern.pattern_key"
                :value="pattern.pattern_key"
              >
                {{ pattern.label }}
              </option>
            </select>
          </label>

          <details class="faq-library-modal__advanced">
            <summary>Configurações avançadas</summary>
            <label class="crm-field-label">
              Chave estável
              <input
                v-model="createForm.bundle_key"
                class="crm-field"
                :placeholder="slug(createForm.title) || 'acesso-ava'"
                @input="onBundleKeyInput"
              />
            </label>
          </details>

          <div class="crm-form-actions faq-library-modal__actions">
            <button type="button" class="crm-button-secondary" @click="closeCreateModal">
              Cancelar
            </button>
            <button class="crm-button-primary" type="submit" :disabled="saving">
              {{ saving ? 'Criando…' : 'Criar e abrir Editor' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="themeModalOpen"
      class="faq-library-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-theme-modal-title"
    >
      <div class="faq-library-modal__backdrop" @click="closeThemeModal" />
      <section class="faq-library-modal__panel crm-panel">
        <header class="faq-library-modal__header">
          <div>
            <h2 id="create-theme-modal-title">Criar novo tema</h2>
            <p>Defina governança editorial antes de criar fluxos neste tema.</p>
          </div>
          <button type="button" class="crm-button-secondary" @click="closeThemeModal">
            Fechar
          </button>
        </header>

        <form class="faq-library-modal__form" @submit.prevent="createTheme">
          <label class="crm-field-label">
            Nome do tema
            <input v-model="themeForm.theme_label" class="crm-field" required />
          </label>
          <label class="crm-field-label">
            Chave do tema
            <input
              v-model="themeForm.theme_key"
              class="crm-field"
              :placeholder="slug(themeForm.theme_label) || 'acesso-ava'"
              required
            />
          </label>
          <label class="crm-field-label">
            Nome da área
            <input v-model="themeForm.area_label" class="crm-field" required />
          </label>
          <label class="crm-field-label">
            Chave da área
            <input
              v-model="themeForm.area_key"
              class="crm-field"
              :placeholder="slug(themeForm.area_label) || 'geral'"
              required
              @input="onAreaKeyInput"
            />
          </label>
          <label class="crm-field-label">
            Responsável principal
            <input
              v-model="themeForm.owner_email"
              class="crm-field"
              type="email"
              required
            />
          </label>
          <label class="crm-field-label">
            Grupo aprovador
            <select v-model="themeForm.approver_group" class="crm-field">
              <option value="">Opcional</option>
              <option
                v-for="group in accessGroups"
                :key="group.id"
                :value="group.id"
              >
                {{ group.label }}
              </option>
            </select>
          </label>
          <div class="crm-form-actions faq-library-modal__actions">
            <button type="button" class="crm-button-secondary" @click="closeThemeModal">
              Cancelar
            </button>
            <button class="crm-button-primary" type="submit" :disabled="saving">
              {{ saving ? 'Criando…' : 'Criar tema' }}
            </button>
          </div>
        </form>
      </section>
    </div>
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

.crm-page-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.crm-page-header > :first-child {
  min-width: 0;
  flex: 1 1 16rem;
}

.crm-page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 0 0 auto;
  justify-content: flex-start;
}

@media (min-width: 768px) {
  .crm-page-header__actions {
    justify-content: flex-end;
  }
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

.crm-table-secondary {
  display: block;
  margin-top: 0.25rem;
}

.crm-inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.faq-library-empty {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  padding-block: var(--space-2);
}

.faq-library-empty p {
  margin: 0;
  color: var(--color-text-muted);
}

.crm-table-scroll table {
  min-width: 72rem;
}

.faq-library-modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}

.faq-library-modal__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-text) 45%, transparent);
}

.faq-library-modal__panel {
  position: relative;
  z-index: 1;
  width: min(42rem, 100%);
  max-height: min(90vh, 52rem);
  overflow: auto;
}

.faq-library-modal__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.faq-library-modal__header h2 {
  margin: 0;
}

.faq-library-modal__form {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: minmax(0, 1fr);
}

.faq-library-modal__theme {
  display: grid;
  gap: var(--space-2);
}

.faq-library-modal__theme-action {
  justify-self: start;
}

.faq-library-modal__channels {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faq-library-modal__channels legend {
  padding-inline: var(--space-1);
}

.faq-library-modal__channels label {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.faq-library-modal__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-library-modal__advanced {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faq-library-modal__advanced summary {
  cursor: pointer;
  font-weight: 700;
}

.faq-library-modal__advanced label {
  display: block;
  margin-top: var(--space-3);
}

.faq-library-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>
