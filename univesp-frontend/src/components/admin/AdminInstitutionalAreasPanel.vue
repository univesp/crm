<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import { createInstitutionalArea, listInstitutionalAreas } from '@/services/appApi'

const loading = ref(false)
const savingArea = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const areas = ref([])

const areaForm = reactive({
  area_label: '',
  area_key: '',
  reason: '',
})

const activeAreas = computed(() => areas.value.filter((area) => area.active !== false))

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

function onAreaLabelInput() {
  if (!areaForm.area_key.trim()) {
    areaForm.area_key = slugify(areaForm.area_label)
  }
}

async function loadAreasPanel() {
  loading.value = true
  errorMessage.value = ''
  try {
    const areasResponse = await listInstitutionalAreas()
    areas.value = Array.isArray(areasResponse.data) ? areasResponse.data : []
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível carregar o catálogo de áreas.'
  } finally {
    loading.value = false
  }
}

async function submitArea() {
  savingArea.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await createInstitutionalArea({
      area_label: areaForm.area_label.trim(),
      area_key: slugify(areaForm.area_key || areaForm.area_label),
      reason: areaForm.reason.trim(),
    })
    areaForm.area_label = ''
    areaForm.area_key = ''
    areaForm.reason = ''
    successMessage.value = 'Área cadastrada. Atribua às pessoas na aba Usuários, abrindo cada perfil.'
    await loadAreasPanel()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível cadastrar a área.'
  } finally {
    savingArea.value = false
  }
}

onMounted(() => {
  void loadAreasPanel()
})
</script>

<template>
  <section class="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4" aria-labelledby="areas-panel-title">
    <div>
      <h2 id="areas-panel-title" class="text-lg font-semibold text-slate-950">Áreas institucionais</h2>
      <p class="mt-1 text-sm text-slate-600">
        Cadastre as áreas usadas no encaminhamento de protocolos e no escopo operacional das pessoas.
        A atribuição é feita em <strong>Usuários → abrir pessoa → Áreas</strong>.
      </p>
    </div>

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

    <form class="grid gap-3 rounded-[8px] bg-slate-50 p-4" @submit.prevent="submitArea">
      <h3 class="text-sm font-semibold uppercase tracking-normal text-slate-500">Cadastrar área</h3>
      <label class="grid gap-1">
        <span class="text-sm font-semibold text-slate-700">Nome da área</span>
        <input
          v-model="areaForm.area_label"
          class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Ex.: Secretaria de Registro Acadêmico"
          required
          @input="onAreaLabelInput"
        />
      </label>
      <label class="grid gap-1">
        <span class="text-sm font-semibold text-slate-700">Chave da área</span>
        <input
          v-model="areaForm.area_key"
          class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Ex.: sra"
          required
        />
      </label>
      <label class="grid gap-1">
        <span class="text-sm font-semibold text-slate-700">Motivo da criação</span>
        <input
          v-model="areaForm.reason"
          class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Ex.: Nova área responsável por acesso ao AVA"
          minlength="5"
          required
        />
      </label>
      <button
        type="submit"
        class="justify-self-start rounded-[8px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
        :disabled="savingArea"
      >
        {{ savingArea ? 'Salvando...' : 'Cadastrar área' }}
      </button>
    </form>

    <div class="grid gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-normal text-slate-500">Áreas cadastradas</h3>
      <p v-if="loading" class="text-sm text-slate-500">Carregando catálogo...</p>
      <p v-else-if="!activeAreas.length" class="text-sm text-slate-500">Nenhuma área cadastrada ainda.</p>
      <ul v-else class="grid gap-2">
        <li
          v-for="area in activeAreas"
          :key="area.id || area.area_key"
          class="flex items-center justify-between rounded-[8px] border border-slate-200 px-3 py-2"
        >
          <div>
            <p class="font-semibold text-slate-950">{{ area.area_label }}</p>
            <p class="text-xs text-slate-500">{{ area.area_key }}</p>
          </div>
          <span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Ativa</span>
        </li>
      </ul>
    </div>
  </section>
</template>
