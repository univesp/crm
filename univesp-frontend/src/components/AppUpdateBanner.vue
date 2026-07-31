<script setup>
import { onMounted, ref } from 'vue'

const visible = ref(false)
let updateSW = null

onMounted(async () => {
  try {
    const { registerSW } = await import('virtual:pwa-register')
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        visible.value = true
      },
      onOfflineReady() {
        // Offline shell ready — no banner required.
      },
    })
  } catch {
    // PWA virtual module may be absent in some test builds.
  }
})

async function refreshNow() {
  visible.value = false
  if (typeof updateSW === 'function') {
    await updateSW(true)
  } else {
    window.location.reload()
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="app-update-banner"
    role="status"
    aria-live="polite"
  >
    <p>Há uma nova versão do sistema disponível. Atualizar agora.</p>
    <button type="button" class="crm-button-primary" @click="refreshNow">
      Atualizar agora
    </button>
  </div>
</template>

<style scoped>
.app-update-banner {
  position: fixed;
  inset-inline: var(--space-4);
  inset-block-end: var(--space-4);
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-md, none);
}

.app-update-banner p {
  margin: 0;
  font-weight: 600;
}
</style>
