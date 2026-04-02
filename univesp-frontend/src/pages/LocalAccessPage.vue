<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { groupMockProfilesByShell, normalizeMockProfileKey } from '@/services/mockContextRuntime'
import { getPublicAppPath, normalizeInternalRouteTarget } from '@/services/ssoClient'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const redirectTarget = computed(() =>
  normalizeInternalRouteTarget(String(route.query.redirect || ''), ''),
)
const profileKey = computed(() => String(route.params.profileKey || '').trim().toLowerCase())
const profiles = computed(() => auth.localBypassProfiles)
const groupedProfiles = computed(() => groupMockProfilesByShell(profiles.value))
const selectedProfile = computed(() => {
  if (!auth.hasLocalBypass) {
    return null
  }

  const normalizedProfileKey = normalizeMockProfileKey(profileKey.value)
  return profiles.value.find((entry) => entry.key === normalizedProfileKey) || null
})

function getProfileAccessUrl(key) {
  return getPublicAppPath(`/acesso-local/${key}`)
}

function getProfileIcon(profileKeyValue) {
  const normalizedKey = normalizeMockProfileKey(profileKeyValue)

  if (normalizedKey === 'admin_central') {
    return 'admin_panel_settings'
  }

  if (normalizedKey === 'gestor_area') {
    return 'monitoring'
  }

  if (normalizedKey === 'analista_area') {
    return 'fact_check'
  }

  if (normalizedKey === 'gestor_polos') {
    return 'lan'
  }

  if (normalizedKey === 'op') {
    return 'support_agent'
  }

  return 'school'
}

watchEffect(() => {
  if (!auth.hasLocalBypass) {
    return
  }

  if (!profileKey.value) {
    auth.clearLocalBypassProfile()
    return
  }

  if (!selectedProfile.value) {
    return
  }

  auth.activateLocalBypassProfile(selectedProfile.value.key, redirectTarget.value || selectedProfile.value.route)
})
</script>

<template>
  <section class="crm-sso-screen">
    <div class="crm-sso-grid" aria-hidden="true"></div>
    <div class="crm-sso-orb crm-sso-orb-primary" aria-hidden="true"></div>
    <div class="crm-sso-orb crm-sso-orb-secondary" aria-hidden="true"></div>

    <main class="crm-sso-layout">
      <section class="crm-sso-shell crm-local-shell">
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
              <span class="material-symbols-outlined" aria-hidden="true">hub</span>
            </div>

            <div>
              <p class="crm-sso-kicker">Acesso local do frontend</p>
              <h1>Escolha o perfil de teste</h1>
              <p class="crm-sso-copy">
                Esta entrada existe apenas para desenvolvimento local em modo mock. O SSO real continua reservado para a integracao futura com o Acesso Unificado.
              </p>
            </div>
          </div>

          <div v-if="auth.hasLocalBypass" class="crm-sso-access-grid">
            <section
              v-for="group in groupedProfiles"
              :key="group.shellKey"
              class="crm-local-shell-group"
            >
              <div class="crm-local-shell-copy">
                <p class="crm-local-shell-kicker">{{ group.shellLabel }}</p>
                <p class="crm-local-shell-description">{{ group.shellDescription }}</p>
              </div>

              <div class="crm-sso-access-grid crm-local-grid">
                <a
                  v-for="profile in group.profiles"
                  :key="profile.key"
                  class="crm-sso-access-button"
                  :href="getProfileAccessUrl(profile.key)"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">
                    {{ getProfileIcon(profile.key) }}
                  </span>
                  <span>
                    {{ profile.label }}
                    <small>{{ profile.email }}</small>
                  </span>
                  <small>{{ profile.helper }}</small>
                </a>
              </div>
            </section>
          </div>

          <div v-else class="crm-sso-error" role="alert" aria-live="polite">
            O bypass local de SSO nao esta habilitado neste ambiente. Reinicie o Vite apos ativar um dos perfis locais.
          </div>

          <div v-if="auth.hasLocalBypass && selectedProfile" class="crm-local-hint">
            <p>Redirecionando para {{ selectedProfile.label }}...</p>
          </div>
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
}

.crm-sso-orb-secondary {
  inset: 16% 5% auto auto;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
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

.crm-local-shell {
  max-width: 880px;
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
  max-width: 42rem;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.6;
}

.crm-sso-access-grid {
  display: grid;
  gap: 14px;
  margin-top: 32px;
}

.crm-local-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.crm-local-shell-group {
  display: grid;
  gap: 14px;
}

.crm-local-shell-copy {
  display: grid;
  gap: 4px;
}

.crm-local-shell-kicker {
  margin: 0;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.crm-local-shell-description {
  margin: 0;
  color: var(--muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

.crm-sso-access-button {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 14px;
  min-height: 140px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  padding: 22px;
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
  font-size: 1.8rem;
}

.crm-sso-access-button span small,
.crm-sso-access-button > small {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.5;
}

.crm-sso-error {
  margin: 24px 0 0;
  border: 1px solid rgba(141, 17, 23, 0.16);
  border-radius: 20px;
  background: var(--danger-soft);
  padding: 14px 16px;
  color: var(--danger);
  font-size: 0.95rem;
  line-height: 1.5;
}

.crm-local-hint {
  margin-top: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 600;
}

@media (max-width: 920px) {
  .crm-local-grid {
    grid-template-columns: 1fr;
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
}
</style>
