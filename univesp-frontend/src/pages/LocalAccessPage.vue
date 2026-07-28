<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import InstitutionalPublicLayout from '@/components/institutional/InstitutionalPublicLayout.vue'
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
  if (!auth.canOpenProfilePreview) {
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
  if (!auth.canOpenProfilePreview) {
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
  <InstitutionalPublicLayout>
    <section class="crm-sso-shell crm-local-shell" aria-labelledby="local-access-title">
      <section class="crm-sso-panel">
        <div class="crm-sso-head">
          <div class="crm-sso-icon">
            <span class="material-symbols-outlined" aria-hidden="true">hub</span>
          </div>

          <div>
            <p class="crm-sso-kicker">{{ auth.hasProfilePreview ? 'Homologacao' : 'Ambiente local' }}</p>
            <h2 id="local-access-title">Escolha um perfil</h2>
            <p class="crm-sso-copy">
              {{
                auth.hasProfilePreview
                  ? 'Voce ja entrou com SSO. Escolha um perfil para validar a navegacao e a UX com dados de demonstracao.'
                  : 'Use esta entrada para validar a navegacao por perfil antes da integracao completa de SSO.'
              }}
            </p>
          </div>
        </div>

        <div v-if="auth.canOpenProfilePreview" class="crm-sso-access-grid">
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
          O acesso local não está habilitado neste ambiente.
        </div>

        <div v-if="auth.canOpenProfilePreview && selectedProfile" class="crm-local-hint" aria-live="polite">
          <p>Redirecionando para {{ selectedProfile.label }}...</p>
        </div>
      </section>
    </section>
  </InstitutionalPublicLayout>
</template>

<style scoped>
.crm-sso-shell {
  margin: 0 auto;
}

.crm-local-shell {
  max-width: 880px;
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
  max-width: 42rem;
  color: var(--crm-color-muted);
  font-size: 1rem;
  line-height: 1.55;
}

.crm-sso-access-grid {
  display: grid;
  gap: 14px;
  margin-top: 28px;
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
  color: var(--crm-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.crm-local-shell-description {
  margin: 0;
  color: var(--crm-color-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

.crm-sso-access-button {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 12px;
  min-height: 132px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-surface);
  padding: 18px;
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
  font-size: 1.8rem;
}

.crm-sso-access-button span small,
.crm-sso-access-button > small {
  display: block;
  margin-top: 8px;
  color: var(--crm-color-muted);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.5;
}

.crm-sso-error {
  margin: 24px 0 0;
  border: 1px solid var(--crm-color-danger-border);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-danger-soft);
  padding: 14px;
  color: var(--crm-color-danger);
  font-size: 0.95rem;
  line-height: 1.5;
}

.crm-local-hint {
  margin-top: 24px;
  text-align: center;
  color: var(--crm-color-muted);
  font-size: 0.95rem;
  font-weight: 600;
}

@media (max-width: 920px) {
  .crm-local-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .crm-sso-panel {
    padding: 24px 20px;
  }

  .crm-sso-head h2 {
    font-size: 1.45rem;
  }
}
</style>
