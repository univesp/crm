<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="bpo-stub">
    <h1>Dashboard BPO</h1>
    <p>
      Area reservada para operadores externos (<code>op_externo</code>). Disponivel na Fase B com escopo
      regional/pool de polos.
    </p>
    <button type="button" @click="router.push('/op/fila')">Ir para fila operacional</button>
  </main>
</template>

<style scoped>
.bpo-stub {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
}
</style>
