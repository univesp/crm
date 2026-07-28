<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const STORAGE_KEY = 'univesp.crm.a11y.public'
const fontScale = ref(0)
const highContrast = ref(false)
const readableFont = ref(false)

const scaleLabel = computed(() => {
  if (fontScale.value === 2) {
    return 'Texto 125%'
  }

  if (fontScale.value === 1) {
    return 'Texto 112%'
  }

  return 'Texto padrão'
})

function publicAsset(path) {
  const base = String(import.meta.env.BASE_URL || '/')
  return `${base}${String(path).replace(/^\/+/, '')}`
}

function persistPreferences() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fontScale: fontScale.value,
        highContrast: highContrast.value,
        readableFont: readableFont.value,
      }),
    )
  } catch {
    // Preferências visuais não devem bloquear o acesso.
  }
}

function applyPreferences(shouldPersist = true) {
  const root = document.documentElement
  root.classList.toggle('a11y-zoom-lg', fontScale.value === 1)
  root.classList.toggle('a11y-zoom-xl', fontScale.value === 2)
  root.classList.toggle('a11y-high-contrast', highContrast.value)
  root.classList.toggle('a11y-readable', readableFont.value)

  if (shouldPersist) {
    persistPreferences()
  }
}

function clearDocumentPreferences() {
  const root = document.documentElement
  root.classList.remove('a11y-zoom-lg', 'a11y-zoom-xl', 'a11y-high-contrast', 'a11y-readable')
}

function loadPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    fontScale.value = Number.isInteger(stored.fontScale)
      ? Math.max(0, Math.min(2, stored.fontScale))
      : 0
    highContrast.value = stored.highContrast === true
    readableFont.value = stored.readableFont === true
  } catch {
    fontScale.value = 0
    highContrast.value = false
    readableFont.value = false
  }

  applyPreferences(false)
}

function increaseText() {
  fontScale.value = Math.min(2, fontScale.value + 1)
  applyPreferences()
}

function decreaseText() {
  fontScale.value = Math.max(0, fontScale.value - 1)
  applyPreferences()
}

function toggleContrast() {
  highContrast.value = !highContrast.value
  applyPreferences()
}

function toggleReadableFont() {
  readableFont.value = !readableFont.value
  applyPreferences()
}

function resetPreferences() {
  fontScale.value = 0
  highContrast.value = false
  readableFont.value = false
  applyPreferences()
}

onMounted(loadPreferences)
onUnmounted(clearDocumentPreferences)
</script>

<template>
  <div class="institutional-public-shell">
    <a class="institutional-skip-link" href="#main-content">Ir para o conteúdo</a>

    <header class="institutional-govbar" aria-label="Governo do Estado de São Paulo">
      <a
        class="institutional-govbar-brand"
        href="https://www.saopaulo.sp.gov.br/"
        target="_blank"
        rel="noreferrer"
      >
        <img
          :src="publicAsset('brand/gov/logo-governo-sp.png')"
          alt="Governo do Estado de São Paulo"
        />
      </a>

      <nav class="institutional-a11y" aria-label="Ferramentas de acessibilidade">
        <button type="button" @click="increaseText">
          <img :src="publicAsset('brand/gov/a-plus.svg')" alt="" aria-hidden="true" />
          <span>Aumentar texto</span>
        </button>

        <button type="button" @click="decreaseText">
          <img :src="publicAsset('brand/gov/a-minus.svg')" alt="" aria-hidden="true" />
          <span>Diminuir texto</span>
        </button>

        <button
          type="button"
          :aria-pressed="highContrast"
          @click="toggleContrast"
        >
          <img :src="publicAsset('brand/gov/contrast.svg')" alt="" aria-hidden="true" />
          <span>Alto contraste</span>
        </button>

        <button
          type="button"
          :aria-pressed="readableFont"
          @click="toggleReadableFont"
        >
          <img :src="publicAsset('brand/gov/accessibility.svg')" alt="" aria-hidden="true" />
          <span>Fonte legível</span>
        </button>

        <button type="button" @click="resetPreferences">
          <span aria-hidden="true">Aa</span>
          <span>Redefinir</span>
        </button>

        <output class="institutional-a11y-status" aria-live="polite">
          {{ scaleLabel }}
        </output>
      </nav>
    </header>

    <section class="institutional-product-header" aria-label="Identificação institucional">
      <a
        class="institutional-product-brand"
        href="https://univesp.br/"
        target="_blank"
        rel="noreferrer"
        aria-label="Univesp"
      >
        <img :src="publicAsset('brand/univesp-logo-header.svg')" alt="Univesp" />
      </a>

      <div class="institutional-product-copy">
        <p>CRM Univesp</p>
        <h1>Sistema de Atendimento</h1>
      </div>
    </section>

    <main id="main-content" class="institutional-public-main" tabindex="-1">
      <slot />
    </main>

    <footer class="institutional-footer">
      <div>
        <strong>Univesp</strong>
        <span>Universidade Virtual do Estado de São Paulo</span>
      </div>

      <nav aria-label="Links institucionais">
        <a href="https://univesp.br/" target="_blank" rel="noreferrer">Portal Univesp</a>
        <a href="https://www.saopaulo.sp.gov.br/" target="_blank" rel="noreferrer">Governo SP</a>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.institutional-public-shell {
  min-height: 100vh;
  min-height: 100svh;
  background: var(--crm-color-bg);
  color: var(--crm-color-text);
}

.institutional-skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 50;
  transform: translateY(-140%);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-text);
  padding: 10px 14px;
  color: var(--crm-color-surface);
  font-weight: 700;
  text-decoration: none;
}

.institutional-skip-link:focus {
  transform: translateY(0);
  outline: 3px solid var(--crm-color-focus);
  outline-offset: 3px;
}

.institutional-govbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--crm-color-border);
  background: var(--crm-color-surface);
  padding: 8px clamp(16px, 4vw, 40px);
}

.institutional-govbar-brand {
  display: inline-flex;
  align-items: center;
  min-width: max-content;
}

.institutional-govbar-brand img {
  display: block;
  width: auto;
  height: 34px;
}

.institutional-a11y {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.institutional-a11y button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  border: 1px solid transparent;
  border-radius: var(--crm-radius-sm);
  background: transparent;
  padding: 0 10px;
  color: var(--crm-color-text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.institutional-a11y button:hover,
.institutional-a11y button[aria-pressed='true'] {
  border-color: var(--crm-color-border-strong);
  background: var(--crm-color-surface-muted);
}

.institutional-a11y button:focus-visible {
  outline: 3px solid var(--crm-color-focus);
  outline-offset: 2px;
}

.institutional-a11y img {
  width: 18px;
  height: 18px;
}

.institutional-a11y-status {
  min-width: 86px;
  color: var(--crm-color-muted);
  font-size: 0.82rem;
  text-align: right;
}

.institutional-product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 20px;
}

.institutional-product-brand {
  display: inline-flex;
  align-items: center;
}

.institutional-product-brand img {
  display: block;
  width: min(220px, 48vw);
  height: auto;
}

.institutional-product-copy {
  text-align: right;
}

.institutional-product-copy p,
.institutional-product-copy h1 {
  margin: 0;
}

.institutional-product-copy p {
  color: var(--crm-color-muted);
  font-size: 0.86rem;
  font-weight: 700;
  text-transform: uppercase;
}

.institutional-product-copy h1 {
  margin-top: 4px;
  color: var(--crm-color-text);
  font-size: 1.2rem;
  line-height: 1.2;
}

.institutional-public-main {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 16px 0 48px;
}

.institutional-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid var(--crm-color-border);
  background: var(--crm-color-surface);
  padding: 20px clamp(16px, 4vw, 40px);
  color: var(--crm-color-muted);
  font-size: 0.9rem;
}

.institutional-footer div {
  display: grid;
  gap: 4px;
}

.institutional-footer strong {
  color: var(--crm-color-text);
}

.institutional-footer nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14px;
}

.institutional-footer a {
  color: var(--crm-color-link);
  font-weight: 700;
  text-decoration: none;
}

.institutional-footer a:hover {
  text-decoration: underline;
}

@media (prefers-color-scheme: dark) {
  .institutional-govbar-brand img,
  .institutional-product-brand img {
    filter: brightness(1.2);
  }

  .institutional-a11y img {
    filter: invert(1);
  }
}

@media (max-width: 760px) {
  .institutional-govbar,
  .institutional-product-header,
  .institutional-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .institutional-a11y,
  .institutional-footer nav {
    justify-content: flex-start;
  }

  .institutional-product-copy {
    text-align: left;
  }
}
</style>
