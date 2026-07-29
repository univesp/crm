<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  badgeLabel: {
    type: String,
    default: '',
  },
  highlighted: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: false,
  },
  eyebrow: {
    type: String,
    default: '',
  },
  topics: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select'])

const cardClasses = computed(() => [
  'group w-full rounded-[8px] border p-4 text-left transition duration-200 focus-visible:outline-none',
  props.highlighted
    ? 'border-[rgba(209,50,57,0.2)] bg-[var(--color-primary-soft)] shadow-sm'
    : 'border-[rgba(16,18,20,0.08)] bg-white shadow-sm',
  props.active
    ? 'ring-2 ring-[rgba(209,50,57,0.18)] shadow-sm'
    : 'hover:bg-slate-50 hover:border-[rgba(209,50,57,0.18)] hover:bg-white',
])

function handleSelect() {
  emit('select')
}
</script>

<template>
  <button type="button" :class="cardClasses" @click="handleSelect">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p
          v-if="eyebrow"
          class="text-xs font-semibold tracking-normal text-slate-500"
        >
          {{ eyebrow }}
        </p>
        <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ title }}</h3>
        <p v-if="description" class="mt-2 text-sm leading-6 text-slate-600">{{ description }}</p>
      </div>

      <span
        v-if="badgeLabel"
        class="inline-flex shrink-0 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold tracking-normal text-[var(--color-primary-dark)]"
      >
        {{ badgeLabel }}
      </span>
    </div>

    <div v-if="topics.length" class="mt-4 flex flex-wrap gap-2">
      <span
        v-for="topic in topics.slice(0, 3)"
        :key="topic"
        class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
      >
        {{ topic }}
      </span>
    </div>

    <div
      class="mt-4 flex items-center justify-between text-xs font-semibold tracking-normal"
      :class="highlighted ? 'text-[var(--color-primary-dark)]' : 'text-slate-500'"
    >
      <span>{{ highlighted ? 'Tema em destaque' : 'Fluxo guiado' }}</span>
      <span>{{ active ? 'Aberto' : 'Explorar' }}</span>
    </div>
  </button>
</template>
