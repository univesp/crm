<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const accessStatus = computed(() => auth.user?.raw?.accessStatus || 'pending')
const content = computed(() => {
  if (accessStatus.value === 'rejected') {
    return {
      eyebrow: 'Acesso analisado',
      title: 'Sua solicitacao nao foi aprovada',
      description: 'A identidade foi confirmada, mas o acesso ao Atendimento UNIVESP foi rejeitado. Procure o administrador para revisar a decisao.',
    }
  }
  if (accessStatus.value === 'disabled') {
    return {
      eyebrow: 'Acesso institucional confirmado',
      title: 'Seu acesso esta desativado',
      description: 'Sua conta continua autenticada pelo SSO, mas a autorizacao do Atendimento UNIVESP foi desativada pelo administrador.',
    }
  }
  return {
    eyebrow: 'Acesso institucional confirmado',
    title: 'Sua solicitacao esta pendente',
    description: 'A identidade foi confirmada e a solicitacao de acesso ja foi registrada. Um administrador precisa atribuir seu perfil e escopo.',
  }
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
    <section class="w-full max-w-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p class="text-sm font-semibold text-[var(--color-primary)]">{{ content.eyebrow }}</p>
      <h1 class="mt-3 text-2xl font-semibold text-slate-950">{{ content.title }}</h1>
      <p class="mt-4 text-sm leading-7 text-slate-600">
        {{ content.description }}
      </p>
      <p class="mt-3 text-sm font-semibold text-slate-800">{{ auth.user?.email }}</p>
      <button
        type="button"
        class="mt-6 inline-flex min-h-11 items-center bg-slate-950 px-5 text-sm font-semibold text-white"
        @click="auth.logout()"
      >
        Sair
      </button>
    </section>
  </main>
</template>
