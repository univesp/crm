<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { getAdminCatalogs, listInstitutionalAreas, updateAdminUser } from '@/services/appApi'

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  mode: {
    type: String,
    default: 'demo',
    validator: (value) => ['demo', 'live'].includes(value),
  },
})

const emit = defineEmits(['saved'])

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const reason = ref('')
const catalogAreas = ref([])
const selectedAreas = ref([])

const supportsAreaScope = computed(() =>
  ['gestor_area', 'analista_area', 'admin_central'].includes(props.user.profileKey || props.user.profile_key),
)

const areaOptions = computed(() =>
  catalogAreas.value.map((area) => ({
    value: area.area_key || area.value,
    label: area.area_label || area.label || area.area_key || area.value,
  })),
)

function currentAreaKeys() {
  if (Array.isArray(props.user.areas)) return [...props.user.areas]
  const scopes = props.user.scopes || {}
  if (Array.isArray(scopes.areas)) return [...scopes.areas]
  return (props.user.scopeKeys || [])
    .filter((entry) => String(entry).startsWith('area:'))
    .map((entry) => String(entry).slice(5))
}

function syncSelectedAreas() {
  selectedAreas.value = currentAreaKeys()
}

async function loadCatalog() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [areasResponse, catalogsResponse] = await Promise.all([
      listInstitutionalAreas().catch(() => ({ data: [] })),
      getAdminCatalogs().catch(() => ({ data: { areas: [] } })),
    ])
    const institutional = Array.isArray(areasResponse.data) ? areasResponse.data : []
    const catalog = catalogsResponse.data?.areas || []
    const merged = new Map()
    for (const area of institutional) {
      if (area.area_key) merged.set(area.area_key, area.area_label || area.area_key)
    }
    for (const area of catalog) {
      if (area.value) merged.set(area.value, area.label || area.value)
    }
    catalogAreas.value = [...merged.entries()].map(([area_key, area_label]) => ({ area_key, area_label }))
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível carregar o catálogo de áreas.'
  } finally {
    loading.value = false
  }
}

function toggleArea(areaKey, checked) {
  const next = new Set(selectedAreas.value)
  if (checked) next.add(areaKey)
  else next.delete(areaKey)
  selectedAreas.value = [...next]
}

async function saveAreas() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (props.mode === 'live') {
      const scopes = { ...(props.user.scopes || {}), areas: [...selectedAreas.value] }
      await updateAdminUser(props.user.email || props.user.id, {
        version: props.user.version,
        reason: reason.value.trim(),
        scopes,
        active: props.user.active,
      })
    }
    emit('saved', {
      userId: props.user.id || props.user.email,
      areas: [...selectedAreas.value],
      reason: reason.value.trim(),
    })
    successMessage.value = 'Áreas atualizadas para esta pessoa.'
    reason.value = ''
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível salvar as áreas desta pessoa.'
  } finally {
    saving.value = false
  }
}

watch(
  () => props.user,
  () => {
    syncSelectedAreas()
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  void loadCatalog()
})
</script>

<template>
  <section class="grid gap-4" aria-labelledby="user-areas-title">
    <div>
      <h3 id="user-areas-title" class="text-base font-semibold text-slate-950">Áreas desta pessoa</h3>
      <p class="mt-1 text-sm text-slate-600">
        Selecione uma ou mais áreas institucionais. Elas definem o escopo operacional desta pessoa no atendimento.
      </p>
    </div>

    <p
      v-if="!supportsAreaScope"
      class="rounded-[8px] bg-amber-50 px-3 py-2 text-sm text-amber-900"
      role="status"
    >
      Este perfil não opera por área. Você ainda pode registrar áreas para referência, mas a permissão efetiva depende do perfil base.
    </p>

    <p v-if="errorMessage" role="alert" class="rounded-[8px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
      {{ errorMessage }}
    </p>
    <p
      v-if="successMessage"
      role="status"
      class="rounded-[8px] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
    >
      {{ successMessage }}
    </p>

    <p v-if="loading" class="text-sm text-slate-500">Carregando áreas...</p>
    <p v-else-if="!areaOptions.length" class="text-sm text-slate-500">
      Nenhuma área cadastrada.
      <RouterLink to="/admin/permissoes?tab=areas" class="font-semibold text-[var(--color-primary)]">
        Cadastre em Áreas
      </RouterLink>
      antes de atribuir.
    </p>

    <div v-else class="grid gap-2 sm:grid-cols-2">
      <label
        v-for="area in areaOptions"
        :key="area.value"
        class="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
      >
        <span>{{ area.label }}</span>
        <input
          type="checkbox"
          :checked="selectedAreas.includes(area.value)"
          @change="toggleArea(area.value, $event.target.checked)"
        />
      </label>
    </div>

    <label class="grid gap-1">
      <span class="text-sm font-semibold text-slate-700">Motivo da alteração</span>
      <input
        v-model="reason"
        class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
        placeholder="Ex.: Carla passará a cobrir SRA e Financeiro"
        minlength="5"
        required
      />
    </label>

    <button
      type="button"
      class="justify-self-start rounded-[8px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
      :disabled="saving || !areaOptions.length || reason.trim().length < 5"
      @click="saveAreas"
    >
      {{ saving ? 'Salvando...' : 'Salvar áreas da pessoa' }}
    </button>
  </section>
</template>
