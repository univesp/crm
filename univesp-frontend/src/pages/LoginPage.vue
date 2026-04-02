<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

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
  <section class="crm-sso-screen">
    <div class="crm-sso-grid" aria-hidden="true"></div>
    <div class="crm-sso-orb crm-sso-orb-primary" aria-hidden="true"></div>
    <div class="crm-sso-orb crm-sso-orb-secondary" aria-hidden="true"></div>

    <main class="crm-sso-layout">
      <section class="crm-sso-shell">
        <section class="crm-sso-panel">
          <div class="crm-sso-brand-row">
            <a
              class="crm-sso-brand"
              href="https://univesp.br/"
              target="_blank"
              rel="noreferrer"
              aria-label="UNIVESP"
            >
              <img src="https://apps.univesp.br/common/colorida-positiva.svg" alt="UNIVESP" />
            </a>
          </div>

          <div class="crm-sso-head">
            <div class="crm-sso-icon">
              <span class="material-symbols-outlined" aria-hidden="true">lock_person</span>
            </div>

            <div>
              <p class="crm-sso-kicker">Sistema de Atendimento UNIVESP</p>
              <h1>Entrar com a conta institucional</h1>
              <p class="crm-sso-copy">Informe seu email institucional para seguir ao acesso correto.</p>
            </div>
          </div>

          <form class="crm-sso-form" @submit.prevent="handleSubmit">
            <label class="crm-sso-field" for="institutional-email">
              <span>Email institucional</span>
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
            Azure AD nao configurado. Defina VITE_AZURE_CLIENT_ID e VITE_AZURE_TENANT_ID no .env.
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
              Login academico
              <small>@*.univesp.br</small>
            </a>

            <a class="crm-sso-access-button" :href="studentLoginUrl">
              <span class="material-symbols-outlined" aria-hidden="true">school</span>
              Login aluno
              <small>@aluno.univesp.br</small>
            </a>
          </div>

          <a
            v-if="auth.hasLocalBypass"
            class="crm-sso-dev-link"
            :href="localAccessUrl"
          >
            Entrar pelo acesso local de desenvolvimento
          </a>

          <p v-if="pageError" class="crm-sso-error" role="alert" aria-live="polite">
            {{ pageError }}
          </p>
        </section>
      </section>
    </main>
  </section>
</template>

<style scoped>
.crm-sso-screen {
  --bg: #f8f3f4;
  --surface: rgba(255, 250, 251, 0.84);
  --surface-strong: #ffffff;
  --surface-variant: rgba(247, 232, 234, 0.92);
  --border: rgba(103, 92, 95, 0.18);
  --text: #181114;
  --muted: #675c5f;
  --accent: #b01f2b;
  --accent-soft: rgba(176, 31, 43, 0.12);
  --accent-soft-strong: rgba(176, 31, 43, 0.18);
  --danger: #8d1117;
  --danger-soft: rgba(141, 17, 23, 0.12);
  --warning-bg: rgba(234, 179, 8, 0.12);
  --warning-border: rgba(234, 179, 8, 0.3);
  --warning-text: #854d0e;
  --shadow: 0 24px 72px rgba(46, 11, 14, 0.14);
  --shadow-strong: 0 42px 120px rgba(46, 11, 14, 0.2);
  --radius-xl: 32px;
  --radius-lg: 24px;
  --radius-md: 18px;
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  font-family: 'IBM Plex Sans', sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(176, 31, 43, 0.22), transparent 34%),
    radial-gradient(circle at bottom right, rgba(24, 17, 20, 0.16), transparent 28%),
    linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg) 88%, #ffffff 12%) 50%, var(--surface-variant) 100%);
}

.crm-sso-grid,
.crm-sso-orb {
  pointer-events: none;
  position: fixed;
  inset: 0;
}

.crm-sso-grid {
  background-image:
    linear-gradient(rgba(24, 17, 20, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 17, 20, 0.04) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent 94%);
}

.crm-sso-orb {
  filter: blur(42px);
  opacity: 0.8;
}

.crm-sso-orb-primary {
  inset: auto auto 60% 3%;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: rgba(176, 31, 43, 0.16);
  animation: crm-sso-float 14s ease-in-out infinite;
}

.crm-sso-orb-secondary {
  inset: 16% 5% auto auto;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
  animation: crm-sso-float 18s ease-in-out infinite reverse;
}

.crm-sso-layout {
  position: relative;
  z-index: 1;
  width: min(1220px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 72px;
}

.crm-sso-shell {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 480px;
  margin: 0 auto;
}

.crm-sso-panel {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  padding: 36px;
  animation: crm-sso-fade-up 0.5s cubic-bezier(0.2, 0, 0, 1) both;
}

.crm-sso-panel::before {
  content: '';
  position: absolute;
  top: -110px;
  right: -60px;
  width: 260px;
  height: 260px;
  border-radius: 40px;
  background: linear-gradient(135deg, rgba(176, 31, 43, 0.18), transparent 72%);
  transform: rotate(18deg);
  pointer-events: none;
}

.crm-sso-brand-row {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.crm-sso-brand {
  display: inline-flex;
  align-items: center;
}

.crm-sso-brand img {
  display: block;
  height: 46px;
  width: auto;
}

.crm-sso-head {
  position: relative;
  z-index: 1;
  text-align: center;
}

.crm-sso-icon {
  display: inline-grid;
  place-items: center;
  width: 92px;
  height: 92px;
  margin: 0 auto 12px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(176, 31, 43, 0.18), rgba(176, 31, 43, 0.1));
  color: var(--accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.48);
}

.crm-sso-icon .material-symbols-outlined {
  font-size: 42px;
}

.crm-sso-kicker {
  margin: 0 0 12px;
  color: var(--accent);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.crm-sso-head h1 {
  margin: 0;
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(2.45rem, 5vw, 3.6rem);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.crm-sso-copy {
  margin: 14px auto 0;
  max-width: 22rem;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.6;
}

.crm-sso-form {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 18px;
  margin-top: 32px;
}

.crm-sso-field {
  display: grid;
  gap: 12px;
  color: var(--muted);
  font-size: 0.95rem;
}

.crm-sso-field span {
  color: var(--muted);
  font-weight: 500;
}

.crm-sso-field input {
  width: 100%;
  min-height: 62px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--surface-strong);
  padding: 0 22px;
  color: var(--text);
  font-size: 1rem;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.crm-sso-field input::placeholder {
  color: rgba(103, 92, 95, 0.75);
}

.crm-sso-field input:focus {
  outline: none;
  border-color: rgba(176, 31, 43, 0.3);
  box-shadow:
    0 0 0 4px rgba(176, 31, 43, 0.12),
    0 14px 32px rgba(46, 11, 14, 0.08);
  transform: translateY(-1px);
}

.crm-sso-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 62px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, #cb2231, #b01f2b);
  padding: 0 22px;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 22px 34px rgba(176, 31, 43, 0.22);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  cursor: pointer;
}

.crm-sso-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 28px 42px rgba(176, 31, 43, 0.28);
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
  padding: 12px 16px;
  border: 1px solid var(--warning-border);
  border-radius: 16px;
  background: var(--warning-bg);
  color: var(--warning-text);
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
  gap: 14px;
  margin: 28px 0 18px;
}

.crm-sso-divider span {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(103, 92, 95, 0.24), transparent);
}

.crm-sso-divider p {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.crm-sso-access-grid {
  display: grid;
  gap: 14px;
}

.crm-sso-access-button {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  min-height: 72px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  padding: 0 22px;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease;
}

.crm-sso-access-button:hover {
  transform: translateY(-2px);
  border-color: var(--accent-soft-strong);
  background: var(--accent-soft);
  box-shadow: 0 18px 34px rgba(46, 11, 14, 0.08);
  color: var(--accent);
}

.crm-sso-access-button .material-symbols-outlined {
  font-size: 1.6rem;
}

.crm-sso-access-button small {
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.crm-sso-error {
  margin: 18px 0 0;
  border: 1px solid rgba(141, 17, 23, 0.16);
  border-radius: 20px;
  background: var(--danger-soft);
  padding: 14px 16px;
  color: var(--danger);
  font-size: 0.95rem;
  line-height: 1.5;
}

.crm-sso-dev-link {
  display: inline-flex;
  justify-content: center;
  width: 100%;
  margin-top: 18px;
  color: var(--accent);
  font-size: 0.94rem;
  font-weight: 700;
  text-decoration: none;
}

.crm-sso-dev-link:hover {
  text-decoration: underline;
}

@media (prefers-color-scheme: dark) {
  .crm-sso-screen {
    --bg: #121012;
    --surface: rgba(22, 18, 20, 0.82);
    --surface-strong: #191416;
    --surface-variant: rgba(40, 30, 34, 0.96);
    --border: rgba(211, 194, 197, 0.18);
    --text: #ece0e2;
    --muted: #d3c2c5;
    --accent: #ffb3ba;
    --accent-soft: rgba(255, 179, 186, 0.16);
    --accent-soft-strong: rgba(255, 179, 186, 0.22);
    --danger: #ffb3ba;
    --danger-soft: rgba(255, 179, 186, 0.16);
    --warning-bg: rgba(234, 179, 8, 0.1);
    --warning-border: rgba(234, 179, 8, 0.2);
    --warning-text: #fbbf24;
    --shadow: 0 26px 72px rgba(0, 0, 0, 0.42);
    --shadow-strong: 0 48px 132px rgba(0, 0, 0, 0.5);
    background:
      radial-gradient(circle at top left, rgba(176, 31, 43, 0.12), transparent 34%),
      radial-gradient(circle at bottom right, rgba(88, 10, 18, 0.1), transparent 40%),
      var(--bg);
  }

  .crm-sso-grid {
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  }

  .crm-sso-access-button {
    background: rgba(255, 255, 255, 0.04);
  }

  .crm-sso-access-button small {
    color: var(--muted);
  }

  .crm-sso-field input {
    background: var(--surface-variant);
  }

  .crm-sso-brand img {
    filter: brightness(1.4) saturate(0.85);
  }
}

@media (max-width: 640px) {
  .crm-sso-layout {
    width: min(100%, calc(100% - 24px));
    padding: 20px 0 36px;
  }

  .crm-sso-panel {
    padding: 24px 20px;
    border-radius: 28px;
  }

  .crm-sso-head h1 {
    font-size: clamp(2.2rem, 12vw, 3.1rem);
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

@keyframes crm-sso-fade-up {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes crm-sso-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, 22px, 0);
  }
}
</style>
