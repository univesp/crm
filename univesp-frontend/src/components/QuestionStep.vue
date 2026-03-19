<script setup>
defineProps({
  index: {
    type: Number,
    required: true,
  },
  question: {
    type: Object,
    required: true,
  },
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

function selectOption(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <article class="inner-panel p-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Pergunta {{ index }}
        </p>
        <h3 class="mt-2 text-xl font-semibold text-slate-950">{{ question.title }}</h3>
        <p class="mt-2 text-sm leading-6 text-slate-600">{{ question.help }}</p>
      </div>
      <span class="soft-chip">Opcoes prontas</span>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2">
      <button
        v-for="option in question.options"
        :key="option.value"
        type="button"
        :class="['option-button', modelValue === option.value ? 'is-active' : '']"
        @click="selectOption(option.value)"
      >
        <p class="text-sm font-semibold text-slate-900">{{ option.label }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">{{ option.note }}</p>
      </button>
    </div>
  </article>
</template>
