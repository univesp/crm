<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const modeLabel = computed(() =>
  props.data?.nodeMode === 'final' ? 'Resposta final' : 'Caminho',
)
const hasError = computed(() => props.data?.issueSeverity === 'error')
const hasWarning = computed(() => props.data?.issueSeverity === 'warning')
const cardToneClass = computed(() => {
  if (hasError.value) {
    return 'border-[rgba(166,31,40,0.28)] bg-[rgba(253,236,237,0.92)]'
  }

  if (hasWarning.value) {
    return 'border-[rgba(202,138,4,0.28)] bg-[rgba(254,243,199,0.92)]'
  }

  if (props.data?.nodeMode === 'final') {
    return 'border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.92)]'
  }

  return 'border-slate-300 bg-white'
})

function selectNode() {
  props.data?.onSelect?.()
}

function addPathChild() {
  props.data?.onQuickAddPath?.()
}

function addFinalChild() {
  props.data?.onQuickAddFinal?.()
}
</script>

<template>
  <div
    class="group relative w-[250px] rounded-[16px] border p-3 shadow-sm transition"
    :class="[
      cardToneClass,
      selected ? 'ring-2 ring-[rgba(8,115,145,0.26)]' : '',
    ]"
    @click.stop="selectNode"
  >
    <Handle :position="Position.Left" type="target" />
    <Handle id="target-top" :position="Position.Top" type="target" />

    <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {{ modeLabel }}
    </p>
    <p class="mt-1 text-sm font-semibold leading-5 text-slate-950">
      {{ data.title }}
    </p>
    <p class="mt-2 text-xs leading-5 text-slate-600">
      {{ data.subtitle }}
    </p>

    <div class="mt-2 flex flex-wrap gap-1">
      <span class="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
        {{ data.action }}
      </span>
      <span class="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
        {{ data.queueDestination }}
      </span>
      <span
        v-if="data.issueCount"
        class="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold"
        :class="hasError ? 'text-[var(--color-danger)]' : 'text-[#8a5200]'"
      >
        {{ data.issueCount }} alerta(s)
      </span>
    </div>

    <div
      class="pointer-events-none absolute -right-2 -top-2 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
    >
      <button
        type="button"
        class="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
        @click.stop="addPathChild"
      >
        + caminho
      </button>
      <button
        type="button"
        class="rounded-full border border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.88)] px-2 py-1 text-[10px] font-semibold text-[#0b6e8c]"
        @click.stop="addFinalChild"
      >
        + final
      </button>
    </div>

    <Handle :position="Position.Right" type="source" />
    <Handle id="source-bottom" :position="Position.Bottom" type="source" />
  </div>
</template>
