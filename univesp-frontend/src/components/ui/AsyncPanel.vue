<script setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SgpButton from '@/components/ui/SgpButton.vue'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  isEmpty: { type: Boolean, default: false },
  loadingMessage: { type: String, default: 'Carregando...' },
  emptyTitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' },
  emptyNextStep: { type: String, default: '' },
  showRetry: { type: Boolean, default: true },
  retryLabel: { type: String, default: 'Tentar novamente' },
})

defineEmits(['retry'])
</script>

<template>
  <LoadingState v-if="loading" :message="loadingMessage" />

  <section v-else-if="error" class="async-panel-error">
    <NoticeBanner :message="error" tone="danger" />
    <SgpButton
      v-if="showRetry"
      variant="secondary"
      type="button"
      @click="$emit('retry')"
    >
      {{ retryLabel }}
    </SgpButton>
  </section>

  <EmptyState
    v-else-if="isEmpty"
    :title="emptyTitle"
    :message="emptyMessage || 'Nada para mostrar no momento.'"
    :next-step="emptyNextStep"
  />

  <slot v-else />
</template>
