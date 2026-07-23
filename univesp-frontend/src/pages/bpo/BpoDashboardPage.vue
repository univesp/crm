<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const linkedPolos = computed(() => auth.mockContext?.linkedPolos || [])
const profileLabel = computed(() => auth.user?.profileKey || 'op_externo')
</script>

<template>
  <main class="bpo-dashboard">
    <header>
      <h1>Dashboard BPO</h1>
      <p>
        Operadores externos (<code>{{ profileLabel }}</code>) — escopo regional por pool de polos (Fase B).
      </p>
    </header>

    <section v-if="linkedPolos.length" class="bpo-dashboard__scope">
      <h2>Polos no seu pool</h2>
      <ul>
        <li v-for="polo in linkedPolos" :key="polo">{{ polo }}</li>
      </ul>
    </section>
    <p v-else class="bpo-dashboard__hint">
      Nenhum polo vinculado nesta sessao. Em producao, o escopo vem do perfil Frappe
      (<code>regional_pools</code>).
    </p>

    <nav class="bpo-dashboard__actions">
      <button type="button" @click="router.push('/op/fila')">Ir para fila operacional</button>
    </nav>
  </main>
</template>

<style scoped>
.bpo-dashboard {
  max-width: 42rem;
  margin: 2rem auto;
  padding: 1.5rem;
  display: grid;
  gap: 1.25rem;
}

.bpo-dashboard__scope ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.bpo-dashboard__hint {
  color: var(--color-muted, #64748b);
  font-size: 0.95rem;
}

.bpo-dashboard__actions {
  display: flex;
  gap: 0.75rem;
}
</style>
