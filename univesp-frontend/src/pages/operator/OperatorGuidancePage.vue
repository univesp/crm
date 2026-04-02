<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildStudentFaqHomeEntries, buildStudentFaqRuntime } from '@/services/faqRuntime'
import { buildOperatorPlaybookGuide } from '@/services/operatorQueueRuntime'

const route = useRoute()
const router = useRouter()

const selectedNodeId = ref(String(route.query.node || ''))

const faqRuntime = computed(() => buildStudentFaqRuntime())
const faqNodeIndex = computed(() => {
  const index = new Map()

  function walk(nodes) {
    for (const node of nodes) {
      index.set(node.id, node)
      walk(node.children || [])
    }
  }

  walk(faqRuntime.value.tree)
  return index
})

const faqLeafNodes = computed(() => [...faqNodeIndex.value.values()].filter((node) => !node.children?.length))
const rootEntries = computed(() => buildStudentFaqHomeEntries())
const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)
const activeLineage = computed(() =>
  activeNode.value
    ? activeNode.value.runtime.lineage.map((nodeId) => faqNodeIndex.value.get(nodeId)).filter(Boolean)
    : [],
)
const activeChildren = computed(() => activeNode.value?.children || [])
const activeNodeIsLeaf = computed(() => Boolean(activeNode.value) && activeChildren.value.length === 0)
const playbookGuide = computed(() =>
  activeNodeIsLeaf.value
    ? buildOperatorPlaybookGuide({
        theme: activeNode.value.tema,
        subsubject: activeNode.value.subtema || activeNode.value.titulo_exibido,
      })
    : null,
)

const stageCopy = computed(() => {
  if (!activeNode.value) {
    return {
      title: '',
      description: 'Escolha o assunto para abrir a mesma orientacao do portal e ver o que o OP deve verificar antes de abrir atendimento.',
    }
  }

  if (!activeNodeIsLeaf.value) {
    return {
      title: activeNode.value.pergunta_exibida || 'Qual assunto descreve melhor a demanda?',
      description: 'Percorra o caminho do aluno ate chegar na orientacao final.',
    }
  }

  return {
      title: activeNode.value.titulo_exibido,
      description: 'Veja primeiro o que o aluno encontraria no portal e, logo abaixo, como o OP deve conduzir a tratativa.',
  }
})

const visibleOptions = computed(() => {
  if (!activeNode.value) {
    return rootEntries.value.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      highlighted: entry.highlighted,
      badgeLabel: entry.badgeLabel,
    }))
  }

  if (activeNodeIsLeaf.value) {
    return []
  }

  return activeChildren.value.map((child) => ({
    id: child.id,
    title: child.titulo_exibido,
    description: child.pergunta_exibida || child.descricao_interna || child.resposta || 'Continuar',
    highlighted: child.runtime.isHighlighted,
    badgeLabel: child.runtime.highlightLabel,
  }))
})

const operatorGuideSections = computed(() => {
  if (!playbookGuide.value) {
    return []
  }

  return [
    {
      title: 'O que verificar',
      items: playbookGuide.value.checklist || [],
    },
    {
      title: 'Onde verificar',
      items: (playbookGuide.value.systemsToCheck || []).map((item) => `Consultar sistema: ${item}`),
    },
    {
      title: 'Documentos a observar',
      items: (playbookGuide.value.documentsRequested || []).map((item) => `Validar documento: ${item}`),
    },
  ].filter((section) => section.items.length)
})

function findLeafByThemeSubtheme() {
  const queryTheme = String(route.query.theme || '').trim().toLowerCase()
  const querySubtheme = String(route.query.subtheme || '').trim().toLowerCase()

  if (!queryTheme) {
    return null
  }

  return (
    faqLeafNodes.value.find(
      (node) =>
        String(node.tema || '').trim().toLowerCase() === queryTheme &&
        String(node.subtema || '').trim().toLowerCase() === querySubtheme,
    ) ||
    faqLeafNodes.value.find((node) => String(node.tema || '').trim().toLowerCase() === queryTheme) ||
    null
  )
}

function openNode(nodeId) {
  selectedNodeId.value = nodeId
  router.replace({ path: route.path, query: { node: nodeId } })
}

function goBack() {
  if (!activeLineage.value.length) {
    return
  }

  if (activeLineage.value.length === 1) {
    selectedNodeId.value = ''
    router.replace({ path: route.path, query: {} })
    return
  }

  openNode(activeLineage.value.at(-2).id)
}

const assistedIntakeRoute = computed(() => {
  const query = {}

  if (activeNode.value?.tema) {
    query.theme = activeNode.value.tema
  }

  if (activeNode.value?.subtema) {
    query.subtheme = activeNode.value.subtema
  }

  if (activeNode.value?.id) {
    query.node = activeNode.value.id
  }

  return {
    path: '/op/novo-atendimento',
    query,
  }
})

watch(
  () => route.query.node,
  (nodeId) => {
    const normalized = String(nodeId || '')

    if (!normalized) {
      const leaf = findLeafByThemeSubtheme()
      selectedNodeId.value = leaf?.id || ''
      return
    }

    if (faqNodeIndex.value.has(normalized)) {
      selectedNodeId.value = normalized
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[760px]">
          <p class="text-sm font-semibold text-slate-900">
            Use esta trilha para percorrer a mesma FAQ do aluno e ver rapidamente como a operacao deve conduzir a tratativa.
          </p>
          <p v-if="activeNode && stageCopy.title" class="mt-3 text-base font-semibold text-slate-950">
            {{ stageCopy.title }}
          </p>
          <p :class="['text-sm leading-6 text-slate-600', activeNode && stageCopy.title ? 'mt-2' : '']">
            {{ stageCopy.description }}
          </p>
        </div>

        <button
          v-if="activeNode"
          type="button"
          class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          @click="goBack"
        >
          Etapa anterior
        </button>
      </div>

      <div v-if="activeLineage.length" class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="step in activeLineage"
          :key="step.id"
          type="button"
          class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
          @click="openNode(step.id)"
        >
          {{ step.titulo_exibido }}
        </button>
      </div>
    </section>

    <section class="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
      <div v-if="!activeNode" class="px-5 py-5">
        <div class="grid gap-3 md:grid-cols-2">
          <button
            v-for="option in visibleOptions"
            :key="option.id"
            type="button"
            :class="[
              'rounded-[14px] border px-4 py-4 text-left transition hover:bg-slate-50',
              option.highlighted
                ? 'border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.04)]'
                : 'border-slate-200 bg-white',
            ]"
            @click="openNode(option.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-base font-semibold text-slate-950">{{ option.title }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ option.description }}</p>
              </div>
              <span
                v-if="option.badgeLabel"
                class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-primary-dark)] ring-1 ring-[rgba(209,50,57,0.12)]"
              >
                {{ option.badgeLabel }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div v-else-if="!activeNodeIsLeaf" class="border-t border-slate-200">
        <button
          v-for="option in visibleOptions"
          :key="option.id"
          type="button"
          :class="[
            'flex w-full items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50',
            option.highlighted ? 'bg-[rgba(209,50,57,0.04)]' : 'bg-white',
          ]"
          @click="openNode(option.id)"
        >
          <div>
            <p class="text-base font-semibold text-slate-950">{{ option.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ option.description }}</p>
          </div>
          <span aria-hidden="true" class="mt-1 text-lg font-semibold text-slate-400">&gt;</span>
        </button>
      </div>

      <template v-else>
        <div class="px-5 py-5">
          <div class="rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p class="text-sm font-semibold text-slate-900">{{ activeNode.titulo_exibido }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="step in activeLineage"
                :key="step.id"
                class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {{ step.titulo_exibido }}
              </span>
            </div>
          </div>

          <div class="rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">FAQ do aluno</p>
            <p class="mt-3 text-sm leading-7 text-slate-700">{{ activeNode.resposta }}</p>
          </div>

          <div class="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
            <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">Como o OP deve conduzir</p>

            <div class="mt-4 grid gap-4">
              <div
                v-for="section in operatorGuideSections"
                :key="section.title"
                class="grid gap-2"
              >
                <p class="text-sm font-semibold text-slate-900">{{ section.title }}</p>
                <ul class="grid gap-1.5 text-sm leading-6 text-slate-700">
                  <li v-for="item in section.items" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div class="grid gap-2 rounded-[14px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <p><span class="font-semibold text-slate-900">Resolver no contato atual:</span> quando a orientacao e a checagem sustentarem uma devolutiva segura.</p>
                <p><span class="font-semibold text-slate-900">Abrir atendimento:</span> quando a tratativa precisar continuar no portal com registro formal.</p>
              </div>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <RouterLink
              :to="assistedIntakeRoute"
              class="inline-flex items-center justify-center rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(209,50,57,0.16)]"
            >
              Abrir atendimento em nome do aluno
            </RouterLink>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
