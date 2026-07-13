<script setup>
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
    <section class="w-full max-w-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p class="text-sm font-semibold text-[var(--color-primary)]">Acesso institucional confirmado</p>
      <h1 class="mt-3 text-2xl font-semibold text-slate-950">Seu perfil ainda nao foi vinculado</h1>
      <p class="mt-4 text-sm leading-7 text-slate-600">
        A conta {{ auth.user?.email }} foi autenticada, mas ainda nao possui perfil e escopo no
        Atendimento UNIVESP. Solicite ao administrador o vinculo correto antes de continuar.
      </p>
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
