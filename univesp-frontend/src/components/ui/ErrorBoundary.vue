<script setup>
import { onErrorCaptured, ref } from 'vue'

import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SgpButton from '@/components/ui/SgpButton.vue'

defineProps({
  fallbackMessage: {
    type: String,
    default: 'Esta parte da tela nao carregou. Atualize a pagina ou tente de novo em instantes.',
  },
})

const hasError = ref(false)

onErrorCaptured(() => {
  hasError.value = true
  return false
})

function retry() {
  window.location.reload()
}
</script>

<template>
  <section v-if="hasError" class="async-panel-error">
    <NoticeBanner :message="fallbackMessage" tone="danger" />
    <SgpButton variant="secondary" type="button" @click="retry">Atualizar pagina</SgpButton>
  </section>
  <slot v-else />
</template>
