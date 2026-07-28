<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const APP_VISUAL_PREFERENCES_KEY = 'univesp.crm.visualPreferences'
const panelId = 'accessibility-preferences-panel'

const isOpen = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const visualTheme = ref('light')
const visualScale = ref(0)
const visualReadableFont = ref(false)
const visualHighContrast = ref(false)

const visualScaleLabel = computed(() => {
  if (visualScale.value === 2) {
    return 'Texto grande'
  }

  if (visualScale.value === 1) {
    return 'Texto médio'
  }

  return 'Texto padrão'
})

const visualPreferencesSummary = computed(() => {
  const preferences = [visualTheme.value === 'dark' ? 'tema escuro' : 'tema claro', visualScaleLabel.value]

  if (visualReadableFont.value) {
    preferences.push('fonte legível')
  }

  if (visualHighContrast.value) {
    preferences.push('alto contraste')
  }

  return preferences.join(', ')
})

const hasActivePreferences = computed(
  () =>
    visualTheme.value !== 'light' ||
    visualScale.value > 0 ||
    visualReadableFont.value ||
    visualHighContrast.value,
)

function persistVisualPreferences() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      APP_VISUAL_PREFERENCES_KEY,
      JSON.stringify({
        theme: visualTheme.value,
        scale: visualScale.value,
        readableFont: visualReadableFont.value,
        highContrast: visualHighContrast.value,
      }),
    )
  } catch {
    // Mantem a interface operavel mesmo quando o navegador bloqueia storage.
  }
}

function applyVisualPreferences(shouldPersist = true) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.toggle('theme-dark', visualTheme.value === 'dark')
  root.classList.toggle('theme-light', visualTheme.value !== 'dark')
  root.classList.toggle('a11y-zoom-lg', visualScale.value === 1)
  root.classList.toggle('a11y-zoom-xl', visualScale.value === 2)
  root.classList.toggle('a11y-readable', visualReadableFont.value)
  root.classList.toggle('a11y-high-contrast', visualHighContrast.value)

  if (shouldPersist) {
    persistVisualPreferences()
  }
}

function loadVisualPreferences() {
  if (typeof window === 'undefined') {
    applyVisualPreferences(false)
    return
  }

  try {
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(APP_VISUAL_PREFERENCES_KEY) || '{}',
    )
    visualTheme.value = storedPreferences.theme === 'dark' ? 'dark' : 'light'
    visualScale.value = Math.min(2, Math.max(0, Number(storedPreferences.scale || 0)))
    visualReadableFont.value = storedPreferences.readableFont === true
    visualHighContrast.value = storedPreferences.highContrast === true
  } catch {
    visualTheme.value = 'light'
    visualScale.value = 0
    visualReadableFont.value = false
    visualHighContrast.value = false
  }

  applyVisualPreferences(false)
}

function setVisualTheme(theme) {
  visualTheme.value = theme === 'dark' ? 'dark' : 'light'
  applyVisualPreferences()
}

function increaseVisualScale() {
  visualScale.value = Math.min(2, visualScale.value + 1)
  applyVisualPreferences()
}

function decreaseVisualScale() {
  visualScale.value = Math.max(0, visualScale.value - 1)
  applyVisualPreferences()
}

function toggleReadableFont() {
  visualReadableFont.value = !visualReadableFont.value
  applyVisualPreferences()
}

function toggleHighContrast() {
  visualHighContrast.value = !visualHighContrast.value
  applyVisualPreferences()
}

function resetVisualPreferences() {
  visualTheme.value = 'light'
  visualScale.value = 0
  visualReadableFont.value = false
  visualHighContrast.value = false
  applyVisualPreferences()
}

async function openPanel() {
  isOpen.value = true
  await nextTick()
  panelRef.value?.querySelector('button:not(:disabled)')?.focus()
}

function closePanel() {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false
  triggerRef.value?.focus()
}

function togglePanel() {
  if (isOpen.value) {
    closePanel()
    return
  }

  openPanel()
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    closePanel()
  }
}

function onDocumentPointerDown(event) {
  if (!isOpen.value) {
    return
  }

  const root = triggerRef.value?.closest('.app-a11y-popover-root')
  if (root && !root.contains(event.target)) {
    closePanel()
  }
}

onMounted(() => {
  loadVisualPreferences()
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div class="app-a11y-popover-root">
    <button
      ref="triggerRef"
      type="button"
      class="app-a11y-trigger"
      :aria-expanded="isOpen"
      :aria-controls="panelId"
      aria-haspopup="dialog"
      @click="togglePanel"
    >
      <span class="material-symbols-outlined app-a11y-trigger__icon" aria-hidden="true">accessibility</span>
      <span class="app-a11y-trigger__label">Acessibilidade</span>
      <span
        v-if="hasActivePreferences"
        class="app-a11y-trigger__badge"
        aria-hidden="true"
        title="Preferências personalizadas ativas"
      />
    </button>

    <div
      v-if="isOpen"
      :id="panelId"
      ref="panelRef"
      class="app-a11y-popover"
      role="dialog"
      aria-label="Preferências de visualização"
    >
      <p class="app-a11y-popover__title">Preferências de visualização</p>

      <div class="app-a11y-toolbar__group" role="group" aria-label="Tema">
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :class="{ 'is-active': visualTheme === 'light' }"
          :aria-pressed="visualTheme === 'light'"
          @click="setVisualTheme('light')"
        >
          Claro
        </button>
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :class="{ 'is-active': visualTheme === 'dark' }"
          :aria-pressed="visualTheme === 'dark'"
          @click="setVisualTheme('dark')"
        >
          Escuro
        </button>
      </div>

      <div class="app-a11y-toolbar__group" role="group" aria-label="Tamanho do texto">
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :disabled="visualScale === 0"
          aria-label="Diminuir texto"
          @click="decreaseVisualScale"
        >
          A-
        </button>
        <output class="app-a11y-toolbar__status" aria-live="polite">
          {{ visualScaleLabel }}
        </output>
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :disabled="visualScale === 2"
          aria-label="Aumentar texto"
          @click="increaseVisualScale"
        >
          A+
        </button>
      </div>

      <div class="app-a11y-toolbar__group" role="group" aria-label="Leitura e contraste">
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :class="{ 'is-active': visualReadableFont }"
          :aria-pressed="visualReadableFont"
          @click="toggleReadableFont"
        >
          Fonte legível
        </button>
        <button
          type="button"
          class="app-a11y-toolbar__button"
          :class="{ 'is-active': visualHighContrast }"
          :aria-pressed="visualHighContrast"
          @click="toggleHighContrast"
        >
          Alto contraste
        </button>
        <button
          type="button"
          class="app-a11y-toolbar__button"
          aria-label="Redefinir preferências de visualização"
          @click="resetVisualPreferences"
        >
          Redefinir
        </button>
      </div>

      <p class="sr-only" aria-live="polite">
        Preferências ativas: {{ visualPreferencesSummary }}.
      </p>
    </div>
  </div>
</template>
