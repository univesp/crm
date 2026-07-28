<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import InstitutionalPublicLayout from '@/components/institutional/InstitutionalPublicLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { getPublicAppPath, normalizeInternalRouteTarget } from '@/services/ssoClient'

const route = useRoute()
const auth = useAuthStore()
const email = ref('')
const redirecting = ref(false)
const dismissedRouteError = ref(false)

const redirectPath = computed(() => {
  return normalizeInternalRouteTarget(String(route.query.redirect || '/'), '/')
})

const pageError = computed(() => {
  const routeError = String(route.query.error || '').trim()
  if (routeError && !dismissedRouteError.value) {
    return routeError
  }
  return auth.errorMessage
})

const adminLoginUrl = computed(() => auth.getDirectAccessUrl('admin', redirectPath.value))
const academicLoginUrl = computed(() => auth.getDirectAccessUrl('academico', redirectPath.value))
const studentLoginUrl = computed(() => auth.getDirectAccessUrl('aluno', redirectPath.value))
const localAccessUrl = computed(() => getPublicAppPath('/acesso-local'))

function clearLoginError() {
  dismissedRouteError.value = true
  if (pageError.value) {
    auth.clearError()
  }
}

async function handleSubmit() {
  clearLoginError()
  redirecting.value = true
  await auth.redirectToLogin(redirectPath.value, '', email.value)
}

watch(
  () => route.query.error,
  () => {
    dismissedRouteError.value = false
    redirecting.value = false
  },
)
</script>

<template>
  <InstitutionalPublicLayout>
    <section class="crm-sso-shell" aria-labelledby="login-title">
      <section class="crm-sso-panel">
        <div class="crm-sso-head">
          <div class="crm-sso-icon">
            <span class="material-symbols-outlined" aria-hidden="true">lock_person</span>
          </div>

          <div>
            <p class="crm-sso-kicker">Acesso institucional</p>
            <h2 id="login-title">Entrar com a conta institucional</h2>
            <p class="crm-sso-copy">Informe seu e-mail institucional para seguir ao acesso correto.</p>
          </div>
        </div>

        <form class="crm-sso-form" @submit.prevent="handleSubmit">
          <label class="crm-sso-field" for="institutional-email">
            <span>E-mail institucional</span>
            <input
              id="institutional-email"
              v-model="email"
              type="email"
              name="email"
              placeholder="nome@univesp.br"
              autocomplete="email"
              required
              @input="clearLoginError"
            />
          </label>

          <button class="crm-sso-submit" type="submit" :disabled="redirecting">
            <span class="material-symbols-outlined" aria-hidden="true">
              {{ redirecting ? 'progress_activity' : 'login' }}
            </span>
            {{ redirecting ? 'Redirecionando...' : 'Entrar com SSO' }}
          </button>
        </form>

        <div v-if="!auth.azureReady" class="crm-sso-warning">
          <span class="material-symbols-outlined" aria-hidden="true">warning</span>
          Azure AD não configurado neste ambiente.
        </div>

        <div class="crm-sso-divider" aria-hidden="true">
          <span></span>
          <p>Entradas por perfil</p>
          <span></span>
        </div>

        <div class="crm-sso-access-grid">
          <a class="crm-sso-access-button" :href="adminLoginUrl">
            <span class="material-symbols-outlined" aria-hidden="true">badge</span>
            Login administrativo
            <small>@univesp.br</small>
          </a>

          <a class="crm-sso-access-button" :href="academicLoginUrl">
            <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
            Login acadêmico
            <small>@*.univesp.br</small>
          </a>

          <a class="crm-sso-access-button" :href="studentLoginUrl">
            <span class="material-symbols-outlined" aria-hidden="true">school</span>
            Login aluno
            <small>@aluno.univesp.br</small>
          </a>
        </div>

        <a v-if="auth.hasLocalBypass" class="crm-sso-dev-link" :href="localAccessUrl">
          Acesso local
        </a>

        <p v-if="pageError" class="crm-sso-error" role="alert" aria-live="polite">
          {{ pageError }}
        </p>
      </section>
    </section>
  </InstitutionalPublicLayout>
</template>

<style scoped>
.crm-sso-shell {
  max-width: 480px;
  margin: 0 auto;
}

.crm-sso-panel {
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-surface);
  padding: 32px;
  box-shadow: var(--crm-shadow-sm);
}

.crm-sso-head {
  text-align: center;
}

.crm-sso-icon {
  display: inline-grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-primary-soft);
  color: var(--crm-color-primary);
}

.crm-sso-icon .material-symbols-outlined {
  font-size: 34px;
}

.crm-sso-kicker {
  margin: 0 0 8px;
  color: var(--crm-color-primary);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

.crm-sso-head h2 {
  margin: 0;
  color: var(--crm-color-text);
  font-size: 1.75rem;
  line-height: 1.15;
}

.crm-sso-copy {
  margin: 12px auto 0;
  max-width: 22rem;
  color: var(--crm-color-muted);
  font-size: 1rem;
  line-height: 1.55;
}

.crm-sso-form {
  display: grid;
  gap: 16px;
  margin-top: 28px;
}

.crm-sso-field {
  display: grid;
  gap: 8px;
  color: var(--crm-color-muted);
  font-size: 0.95rem;
}

.crm-sso-field span {
  color: var(--crm-color-text);
  font-weight: 700;
}

.crm-sso-field input {
  width: 100%;
  min-height: 52px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-surface);
  padding: 0 22px;
  color: var(--crm-color-text);
  font-size: 1rem;
}

.crm-sso-field input::placeholder {
  color: var(--crm-color-muted);
}

.crm-sso-field input:focus {
  outline: none;
  border-color: var(--crm-color-primary);
  box-shadow: 0 0 0 3px var(--crm-color-focus-soft);
}

.crm-sso-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 52px;
  border: 0;
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-primary);
  padding: 0 22px;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.crm-sso-submit:hover:not(:disabled) {
  background: var(--crm-color-primary-strong);
}

.crm-sso-submit:disabled {
  cursor: wait;
  opacity: 0.8;
}

.crm-sso-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  border: 1px solid var(--crm-color-warning-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-warning-soft);
  padding: 12px 14px;
  color: var(--crm-color-warning-text);
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.4;
}

.crm-sso-warning .material-symbols-outlined {
  font-size: 20px;
  flex-shrink: 0;
}

.crm-sso-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin: 24px 0 16px;
}

.crm-sso-divider span {
  height: 1px;
  background: var(--crm-color-border);
}

.crm-sso-divider p {
  margin: 0;
  color: var(--crm-color-muted);
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
}

.crm-sso-access-grid {
  display: grid;
  gap: 14px;
}

.crm-sso-access-button {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-surface);
  padding: 12px 16px;
  color: var(--crm-color-text);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
}

.crm-sso-access-button:hover {
  border-color: var(--crm-color-primary);
  background: var(--crm-color-primary-soft);
  color: var(--crm-color-primary);
}

.crm-sso-access-button .material-symbols-outlined {
  font-size: 1.6rem;
}

.crm-sso-access-button small {
  color: var(--crm-color-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.crm-sso-error {
  margin: 18px 0 0;
  border: 1px solid var(--crm-color-danger-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-danger-soft);
  padding: 14px;
  color: var(--crm-color-danger);
  font-size: 0.95rem;
  line-height: 1.5;
}

.crm-sso-dev-link {
  display: inline-flex;
  justify-content: center;
  width: 100%;
  margin-top: 18px;
  color: var(--crm-color-link);
  font-size: 0.94rem;
  font-weight: 700;
  text-decoration: none;
}

.crm-sso-dev-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .crm-sso-panel {
    padding: 24px 20px;
  }

  .crm-sso-head h2 {
    font-size: 1.45rem;
  }

  .crm-sso-access-button {
    grid-template-columns: auto 1fr;
    align-items: start;
    padding-top: 18px;
    padding-bottom: 18px;
  }

  .crm-sso-access-button small {
    grid-column: 2;
  }
}
</style>
