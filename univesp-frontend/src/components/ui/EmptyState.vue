<script setup>
defineProps({
  title: { type: String, default: '' },
  message: { type: String, required: true },
  nextStep: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state" role="status">
    <strong>{{ title || 'Nenhum registro encontrado' }}</strong>
    <p>{{ message }}</p>
    <p v-if="nextStep" class="empty-state-next">{{ nextStep }}</p>
  </div>
</template>
