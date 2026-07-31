<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary'].includes(value),
  },
  type: {
    type: String,
    default: 'button',
    validator: (value) => ['button', 'submit', 'reset'].includes(value),
  },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingLabel: { type: String, default: 'Aguarde...' },
  to: { type: [String, Object], default: '' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const isDisabled = computed(() => props.disabled || props.loading)
const buttonClass = computed(() => [
  'button',
  props.variant === 'secondary' ? 'button-secondary' : 'button-primary',
  props.compact ? 'button-compact' : null,
])

function onClick(event) {
  if (isDisabled.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    :class="buttonClass"
    :aria-disabled="isDisabled || undefined"
    @click="onClick"
  >
    <template v-if="loading">{{ loadingLabel }}</template>
    <slot v-else />
  </RouterLink>
  <button
    v-else
    :type="type"
    :class="buttonClass"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <template v-if="loading">{{ loadingLabel }}</template>
    <slot v-else />
  </button>
</template>
