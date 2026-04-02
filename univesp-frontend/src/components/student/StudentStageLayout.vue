<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

defineProps({
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  mobileLabel: {
    type: String,
    default: '',
  },
  showBack: {
    type: Boolean,
    default: false,
  },
  asideTitle: {
    type: String,
    default: 'Seu caminho',
  },
  asideDescription: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const showMobileHomeLink = computed(() => route.path !== '/aluno')
const headingRef = ref(null)

defineEmits(['back'])

function focusStageHeading() {
  nextTick(() => {
    headingRef.value?.focus()
  })
}

watch(
  () => route.fullPath,
  () => {
    focusStageHeading()
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_196px] xl:items-start">
    <section
      class="rounded-[28px] border border-slate-200 bg-white/94 p-4 shadow-[0_18px_42px_rgba(16,18,20,0.05)] md:p-6 xl:min-h-[468px] xl:p-7"
    >
      <div
        v-if="showBack || mobileLabel"
        class="mb-5 flex items-center gap-3 xl:hidden"
      >
        <component
          :is="showBack ? 'button' : 'span'"
          :class="[
            'inline-flex h-10 items-center justify-center rounded-full',
            showBack
              ? 'student-focus-ring w-10 border border-slate-200 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-50'
              : 'w-10',
          ]"
          :type="showBack ? 'button' : null"
          :aria-label="showBack ? 'Voltar' : null"
          @click="showBack ? $emit('back') : null"
        >
          <template v-if="showBack">&lt;</template>
        </component>
        <p class="min-w-0 flex-1 text-center text-sm font-semibold text-slate-700">
          {{ mobileLabel }}
        </p>
        <RouterLink
          v-if="showMobileHomeLink"
          to="/aluno"
          class="student-focus-ring inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Voltar ao inicio
        </RouterLink>
        <span v-else class="w-10"></span>
      </div>

      <div class="max-w-2xl">
        <p
          v-if="eyebrow"
          class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-dark)]"
        >
          {{ eyebrow }}
        </p>
        <h1
          ref="headingRef"
          tabindex="-1"
          class="mt-3 text-[1.95rem] font-semibold leading-[1.05] text-slate-950 md:text-[2.15rem]"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-3 max-w-2xl text-[0.96rem] leading-7 text-slate-600"
        >
          {{ description }}
        </p>
      </div>

      <div class="mt-6">
        <slot />
      </div>
    </section>

    <aside
      v-if="$slots.aside"
      class="hidden xl:block xl:sticky xl:top-4"
    >
      <div class="rounded-[22px] border border-slate-200 bg-white/76 p-4 shadow-[0_10px_22px_rgba(16,18,20,0.035)]">
        <p class="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-dark)]">
          {{ asideTitle }}
        </p>
        <p
          v-if="asideDescription"
          class="mt-2 text-sm leading-6 text-slate-600"
        >
          {{ asideDescription }}
        </p>

        <div class="mt-4">
          <slot name="aside" />
        </div>
      </div>
    </aside>
  </div>
</template>
