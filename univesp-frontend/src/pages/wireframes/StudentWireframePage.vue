<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { studentWireframeScreenMap, studentWireframeScreens } from '@/data/studentWireframeScreens'

const route = useRoute()
const router = useRouter()

const screens = studentWireframeScreens

const desktopNavigationItems = [
  { label: 'Inicio', route: '/wireframes/aluno/inicio' },
  { label: 'Tenho uma duvida', route: '/wireframes/aluno/tema' },
  { label: 'Minhas solicitacoes', route: '/wireframes/aluno/solicitacoes' },
]

const activeScreen = computed(() => {
  const screenId = String(route.params.screenId || 'inicio').trim().toLowerCase()
  return studentWireframeScreenMap[screenId] || studentWireframeScreenMap.inicio
})

const activeMobile = computed(() => activeScreen.value.mobile)
const activeDesktop = computed(() => activeScreen.value.desktop)

const previousScreen = computed(() =>
  activeScreen.value.previous ? screens.find((screen) => screen.route === activeScreen.value.previous) : null,
)

const nextPrimaryScreen = computed(() =>
  activeScreen.value.primaryNext
    ? screens.find((screen) => screen.route === activeScreen.value.primaryNext)
    : null,
)

function openRoute(target) {
  if (!target) {
    return
  }

  router.push(target)
}

function isDesktopNavActive(item) {
  if (item.route === '/wireframes/aluno/tema') {
    return ['tema', 'subtema', 'triagem', 'resposta', 'resposta-direta', 'solicitacao', 'confirmacao'].includes(
      activeScreen.value.id,
    )
  }

  return activeScreen.value.route === item.route
}

function getOptionLabel(option) {
  return typeof option === 'string' ? option : option.label
}

function getOptionDescription(option) {
  return typeof option === 'string' ? '' : option.description || ''
}

function getOptionRoute(option, fallbackRoute) {
  return typeof option === 'string' ? fallbackRoute : option.route || fallbackRoute
}
</script>

<template>
  <section class="wire-student-page">
    <div class="wire-student-shell">
      <header class="wireframe-header">
        <div class="wireframe-header-copy">
          <p class="wireframe-kicker">Wireframe navegavel</p>
          <h1>Jornada do aluno</h1>
          <p class="wireframe-summary">
            Rodada de validacao visual para fluxo, hierarquia e comportamento mobile-first.
          </p>
        </div>

        <div class="wireframe-header-actions">
          <button type="button" class="wireframe-ghost-link" @click="openRoute('/acesso-local/aluno')">
            Voltar ao acesso local
          </button>
          <button
            v-if="previousScreen"
            type="button"
            class="wireframe-ghost-link"
            @click="openRoute(previousScreen.route)"
          >
            Etapa anterior
          </button>
          <button
            v-if="nextPrimaryScreen"
            type="button"
            class="wireframe-ghost-link"
            @click="openRoute(nextPrimaryScreen.route)"
          >
            Proxima etapa
          </button>
        </div>
      </header>

      <nav class="wireframe-step-nav" aria-label="Etapas do wireframe">
        <button
          v-for="screen in screens"
          :key="screen.id"
          type="button"
          :class="['wireframe-step-chip', screen.id === activeScreen.id && 'wireframe-step-chip-active']"
          @click="openRoute(screen.route)"
        >
          <span>{{ screen.label }}</span>
        </button>
      </nav>

      <div class="wireframe-preview-grid">
        <article class="wireframe-preview-panel">
          <div class="wireframe-preview-head">
            <div>
              <p class="wireframe-panel-label">Mobile-first</p>
              <h2>{{ activeScreen.title }}</h2>
            </div>
            <span class="wireframe-panel-step">{{ activeScreen.progressLabel }}</span>
          </div>

          <div class="wire-mobile-frame">
            <div class="wire-mobile-topbar">
              <button
                type="button"
                class="wire-mobile-topbar-back"
                :disabled="!previousScreen"
                @click="openRoute(previousScreen?.route)"
              >
                &lt;
              </button>
              <span class="wire-mobile-topbar-progress">{{ activeScreen.progressLabel }}</span>
              <span class="wire-mobile-topbar-dot"></span>
            </div>

            <div class="wire-mobile-body">
              <div class="wire-mobile-heading">
                <p class="wire-mobile-eyebrow">{{ activeMobile.eyebrow }}</p>
                <h3>{{ activeMobile.title }}</h3>
                <p v-if="activeMobile.subtitle" class="wire-mobile-subtitle">
                  {{ activeMobile.subtitle }}
                </p>
              </div>

              <div v-if="activeScreen.highlights?.length" class="wire-mobile-highlight-stack">
                <div
                  v-for="highlight in activeScreen.highlights"
                  :key="highlight.title"
                  class="wire-mobile-highlight-card"
                >
                  <p class="wire-mobile-highlight-label">{{ highlight.label }}</p>
                  <strong>{{ highlight.title }}</strong>
                  <span>{{ highlight.description }}</span>
                </div>
              </div>

              <template v-if="activeMobile.type === 'home'">
                <button
                  type="button"
                  class="wire-mobile-card wire-mobile-card-primary"
                  @click="openRoute(activeScreen.primaryNext)"
                >
                  <strong>{{ activeMobile.primaryCta }}</strong>
                </button>

                <button
                  type="button"
                  class="wire-mobile-card wire-mobile-card-secondary"
                  @click="openRoute(activeScreen.secondaryNext)"
                >
                  <strong>{{ activeMobile.secondaryCta }}</strong>
                </button>
              </template>

              <template v-else-if="activeMobile.type === 'choice-list'">
                <div class="wire-mobile-list">
                  <button
                    v-for="option in activeMobile.options"
                    :key="getOptionLabel(option)"
                    type="button"
                    class="wire-mobile-list-item wire-mobile-list-item-rich"
                    @click="openRoute(getOptionRoute(option, activeScreen.primaryNext))"
                  >
                    <div class="wire-mobile-list-copy">
                      <strong>{{ getOptionLabel(option) }}</strong>
                      <span v-if="getOptionDescription(option)">{{ getOptionDescription(option) }}</span>
                    </div>
                    <span>&gt;</span>
                  </button>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'grouped-list'">
                <div class="wire-mobile-status-groups">
                  <section v-for="group in activeMobile.groups" :key="group.label">
                    <h4>{{ group.label }}</h4>
                    <button
                      v-for="item in group.items"
                      :key="item.label"
                      type="button"
                      class="wire-mobile-list-item"
                      @click="openRoute(item.route)"
                    >
                      <span>{{ item.label }}</span>
                      <span>&gt;</span>
                    </button>
                  </section>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'question'">
                <div class="wire-mobile-question-card">
                  <label
                    v-for="option in activeMobile.options"
                    :key="option"
                    class="wire-mobile-option-row"
                  >
                    <span class="wire-mobile-radio"></span>
                    <span>{{ option }}</span>
                  </label>
                </div>

                <button
                  type="button"
                  class="wire-mobile-primary-cta"
                  @click="openRoute(activeScreen.primaryNext)"
                >
                  {{ activeMobile.primaryCta }}
                </button>

                <p class="wire-mobile-footnote">{{ activeMobile.helper }}</p>
              </template>

              <template v-else-if="activeMobile.type === 'response'">
                <div class="wire-mobile-response-card">
                  <p>{{ activeMobile.subtitle }}</p>
                </div>

                <div class="wire-mobile-decision">
                  <p>Essa orientacao resolveu sua duvida?</p>
                  <button
                    type="button"
                    class="wire-mobile-primary-cta"
                    @click="openRoute(activeScreen.primaryNext)"
                  >
                    {{ activeMobile.primaryCta }}
                  </button>
                  <button
                    type="button"
                    class="wire-mobile-secondary-cta"
                    @click="openRoute(activeScreen.secondaryNext)"
                  >
                    {{ activeMobile.secondaryCta }}
                  </button>
                </div>

                <p v-if="activeMobile.note" class="wire-mobile-footnote">
                  {{ activeMobile.note }}
                </p>
              </template>

              <template v-else-if="activeMobile.type === 'form'">
                <div class="wire-mobile-form-summary">
                  <div v-for="item in activeMobile.meta" :key="item" class="wire-mobile-summary-row">
                    {{ item }}
                  </div>
                </div>

                <div class="wire-mobile-textarea">
                  Conte, em poucas palavras, o que ainda precisa de atendimento.
                </div>

                <div class="wire-mobile-upload-card">
                  <strong>{{ activeMobile.uploadLabel }}</strong>
                  <span>{{ activeMobile.uploadHelp }}</span>
                  <div class="wire-mobile-upload-box">Selecionar arquivo</div>
                </div>

                <button
                  type="button"
                  class="wire-mobile-primary-cta"
                  @click="openRoute(activeScreen.primaryNext)"
                >
                  {{ activeMobile.primaryCta }}
                </button>
                <button
                  v-if="activeMobile.secondaryCta"
                  type="button"
                  class="wire-mobile-secondary-cta"
                  @click="openRoute(activeScreen.secondaryNext)"
                >
                  {{ activeMobile.secondaryCta }}
                </button>
              </template>

              <template v-else-if="activeMobile.type === 'confirmation'">
                <div class="wire-mobile-form-summary">
                  <div v-for="item in activeMobile.meta" :key="item" class="wire-mobile-summary-row">
                    {{ item }}
                  </div>
                </div>

                <button
                  type="button"
                  class="wire-mobile-primary-cta"
                  @click="openRoute(activeScreen.primaryNext)"
                >
                  {{ activeMobile.primaryCta }}
                </button>
                <button
                  v-if="activeMobile.secondaryCta"
                  type="button"
                  class="wire-mobile-secondary-cta"
                  @click="openRoute(activeScreen.secondaryNext)"
                >
                  {{ activeMobile.secondaryCta }}
                </button>
              </template>

              <template v-else-if="activeMobile.type === 'requests'">
                <div class="wire-mobile-status-groups">
                  <section v-for="group in activeMobile.statusGroups" :key="group.label">
                    <h4>{{ group.label }}</h4>
                    <button
                      v-for="item in group.items"
                      :key="item"
                      type="button"
                      class="wire-mobile-list-item"
                      @click="openRoute(activeScreen.primaryNext)"
                    >
                      <span>{{ item }}</span>
                      <span>&gt;</span>
                    </button>
                  </section>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'detail'">
                <div class="wire-mobile-status-pill">{{ activeMobile.subtitle }}</div>

                <div class="wire-mobile-form-summary">
                  <div v-for="item in activeMobile.meta" :key="item" class="wire-mobile-summary-row">
                    {{ item }}
                  </div>
                </div>

                <div class="wire-mobile-timeline">
                  <div class="wire-mobile-timeline-item"></div>
                  <div class="wire-mobile-timeline-item"></div>
                  <div class="wire-mobile-timeline-item"></div>
                </div>

                <button type="button" class="wire-mobile-primary-cta">
                  {{ activeMobile.primaryCta }}
                </button>
              </template>
            </div>
          </div>
        </article>

        <article class="wireframe-preview-panel">
          <div class="wireframe-preview-head">
            <div>
              <p class="wireframe-panel-label">Desktop</p>
              <h2>Expansao controlada</h2>
            </div>
            <span class="wireframe-panel-step">{{ activeScreen.progressLabel }}</span>
          </div>

          <div class="wire-desktop-frame">
            <aside class="wire-desktop-sidebar">
              <div class="wire-desktop-brand">UNIVESP</div>
              <nav class="wire-desktop-nav">
                <button
                  v-for="item in desktopNavigationItems"
                  :key="item.label"
                  type="button"
                  :class="['wire-desktop-nav-item', isDesktopNavActive(item) && 'wire-desktop-nav-item-active']"
                  @click="openRoute(item.route)"
                >
                  {{ item.label }}
                </button>
              </nav>
            </aside>

            <main class="wire-desktop-center">
              <div class="wire-desktop-stage-header">
                <p class="wire-desktop-stage-kicker">{{ activeMobile.eyebrow }}</p>
                <h3>{{ activeDesktop.centerTitle }}</h3>
                <p>{{ activeDesktop.centerSubtitle }}</p>
              </div>

              <div v-if="activeScreen.highlights?.length" class="wire-desktop-highlight-stack">
                <div
                  v-for="highlight in activeScreen.highlights"
                  :key="highlight.title"
                  class="wire-desktop-highlight-card"
                >
                  <p class="wire-mobile-highlight-label">{{ highlight.label }}</p>
                  <strong>{{ highlight.title }}</strong>
                  <span>{{ highlight.description }}</span>
                </div>
              </div>

              <template v-if="activeMobile.type === 'home'">
                <div class="wire-desktop-stage-stack">
                  <button
                    type="button"
                    class="wire-desktop-stage-card wire-desktop-stage-card-primary"
                    @click="openRoute(activeScreen.primaryNext)"
                  >
                    <strong>{{ activeMobile.primaryCta }}</strong>
                  </button>
                  <button
                    type="button"
                    class="wire-desktop-stage-card"
                    @click="openRoute(activeScreen.secondaryNext)"
                  >
                    <strong>{{ activeMobile.secondaryCta }}</strong>
                  </button>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'choice-list'">
                <div class="wire-desktop-stage-stack">
                  <button
                    v-for="(option, index) in activeMobile.options"
                    :key="getOptionLabel(option)"
                    type="button"
                    :class="[
                      'wire-desktop-stage-card',
                      'wire-desktop-stage-card-list',
                      index === 0 && 'wire-desktop-stage-card-primary',
                    ]"
                    @click="openRoute(getOptionRoute(option, activeScreen.primaryNext))"
                  >
                    <div class="wire-desktop-choice-copy">
                      <strong>{{ getOptionLabel(option) }}</strong>
                      <small v-if="getOptionDescription(option)">{{ getOptionDescription(option) }}</small>
                    </div>
                    <span>&gt;</span>
                  </button>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'grouped-list'">
                <div class="wire-desktop-status-columns">
                  <section v-for="group in activeMobile.groups" :key="group.label">
                    <h4>{{ group.label }}</h4>
                    <button
                      v-for="item in group.items"
                      :key="item.label"
                      type="button"
                      class="wire-desktop-stage-card wire-desktop-stage-card-list"
                      @click="openRoute(item.route)"
                    >
                      <span>{{ item.label }}</span>
                      <span>&gt;</span>
                    </button>
                  </section>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'question'">
                <div class="wire-desktop-question-card">
                  <label
                    v-for="option in activeMobile.options"
                    :key="option"
                    class="wire-desktop-option-row"
                  >
                    <span class="wire-mobile-radio"></span>
                    <span>{{ option }}</span>
                  </label>
                </div>

                <button
                  type="button"
                  class="wire-desktop-primary-cta"
                  @click="openRoute(activeScreen.primaryNext)"
                >
                  {{ activeMobile.primaryCta }}
                </button>
              </template>

              <template v-else-if="activeMobile.type === 'response'">
                <div class="wire-desktop-response-card">
                  <p>{{ activeMobile.subtitle }}</p>
                </div>

                <div class="wire-desktop-decision-row">
                  <button
                    type="button"
                    class="wire-desktop-primary-cta"
                    @click="openRoute(activeScreen.primaryNext)"
                  >
                    {{ activeMobile.primaryCta }}
                  </button>
                  <button
                    type="button"
                    class="wire-desktop-secondary-cta"
                    @click="openRoute(activeScreen.secondaryNext)"
                  >
                    {{ activeMobile.secondaryCta }}
                  </button>
                </div>

                <p v-if="activeMobile.note" class="wire-desktop-note">
                  {{ activeMobile.note }}
                </p>
              </template>

              <template v-else-if="activeMobile.type === 'form'">
                <div class="wire-desktop-form-card">
                  <div
                    v-for="item in activeMobile.meta"
                    :key="item"
                    class="wire-desktop-form-summary-row"
                  >
                    {{ item }}
                  </div>

                  <div class="wire-desktop-textarea">
                    Conte, em poucas palavras, o que ainda precisa de atendimento.
                  </div>

                  <div class="wire-mobile-upload-card">
                    <strong>{{ activeMobile.uploadLabel }}</strong>
                    <span>{{ activeMobile.uploadHelp }}</span>
                    <div class="wire-mobile-upload-box">Selecionar arquivo</div>
                  </div>
                </div>

                <div class="wire-desktop-decision-row">
                  <button
                    type="button"
                    class="wire-desktop-primary-cta"
                    @click="openRoute(activeScreen.primaryNext)"
                  >
                    {{ activeMobile.primaryCta }}
                  </button>
                  <button
                    v-if="activeMobile.secondaryCta"
                    type="button"
                    class="wire-desktop-secondary-cta"
                    @click="openRoute(activeScreen.secondaryNext)"
                  >
                    {{ activeMobile.secondaryCta }}
                  </button>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'confirmation'">
                <div class="wire-desktop-form-card">
                  <div
                    v-for="item in activeMobile.meta"
                    :key="item"
                    class="wire-desktop-form-summary-row"
                  >
                    {{ item }}
                  </div>
                </div>

                <div class="wire-desktop-decision-row">
                  <button
                    type="button"
                    class="wire-desktop-primary-cta"
                    @click="openRoute(activeScreen.primaryNext)"
                  >
                    {{ activeMobile.primaryCta }}
                  </button>
                  <button
                    v-if="activeMobile.secondaryCta"
                    type="button"
                    class="wire-desktop-secondary-cta"
                    @click="openRoute(activeScreen.secondaryNext)"
                  >
                    {{ activeMobile.secondaryCta }}
                  </button>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'requests'">
                <div class="wire-desktop-status-columns">
                  <section v-for="group in activeMobile.statusGroups" :key="group.label">
                    <h4>{{ group.label }}</h4>
                    <button
                      v-for="item in group.items"
                      :key="item"
                      type="button"
                      class="wire-desktop-stage-card wire-desktop-stage-card-list"
                      @click="openRoute(activeScreen.primaryNext)"
                    >
                      <span>{{ item }}</span>
                      <span>&gt;</span>
                    </button>
                  </section>
                </div>
              </template>

              <template v-else-if="activeMobile.type === 'detail'">
                <div class="wire-desktop-detail-header">
                  <span class="wire-mobile-status-pill">{{ activeMobile.subtitle }}</span>
                </div>

                <div class="wire-desktop-form-card">
                  <div
                    v-for="item in activeMobile.meta"
                    :key="item"
                    class="wire-desktop-form-summary-row"
                  >
                    {{ item }}
                  </div>
                </div>

                <div class="wire-desktop-timeline">
                  <div class="wire-mobile-timeline-item"></div>
                  <div class="wire-mobile-timeline-item"></div>
                  <div class="wire-mobile-timeline-item"></div>
                </div>

                <div class="wire-desktop-decision-row">
                  <button type="button" class="wire-desktop-primary-cta">
                    {{ activeMobile.primaryCta }}
                  </button>
                </div>
              </template>
            </main>

            <aside class="wire-desktop-support">
              <p class="wire-desktop-support-label">{{ activeDesktop.supportTitle }}</p>

              <div class="wire-desktop-trail">
                <button
                  v-for="trailItem in activeScreen.trail"
                  :key="trailItem.label"
                  type="button"
                  class="wire-desktop-trail-item"
                  @click="openRoute(trailItem.route)"
                >
                  {{ trailItem.label }}
                </button>
              </div>

              <div v-for="item in activeDesktop.supportItems" :key="item" class="wire-desktop-support-item">
                {{ item }}
              </div>
            </aside>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
<style scoped>
.wire-student-page {
  min-height: 100vh;
  padding: 24px 18px 40px;
  background:
    radial-gradient(circle at top left, rgba(122, 92, 255, 0.08), transparent 26%),
    linear-gradient(180deg, #f6f4ff 0%, #ffffff 100%);
}

.wire-student-shell {
  margin: 0 auto;
  max-width: 1420px;
}

.wireframe-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.wireframe-header-copy {
  max-width: 680px;
}

.wireframe-kicker,
.wireframe-panel-label,
.wire-mobile-eyebrow,
.wire-desktop-stage-kicker,
.wire-mobile-highlight-label,
.wire-desktop-support-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6f63d9;
}

.wireframe-header h1,
.wireframe-preview-head h2 {
  margin: 6px 0 0;
  font-size: 1.72rem;
  line-height: 1.05;
  color: #161724;
}

.wireframe-summary {
  margin: 8px 0 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: #5c6075;
}

.wireframe-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wireframe-ghost-link {
  border: 1px solid #ddd8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  padding: 10px 14px;
  color: #3c4055;
  font-size: 0.86rem;
  font-weight: 600;
}

.wireframe-step-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.wireframe-step-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid #dfdbf1;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  padding: 8px 12px;
  color: #4d5167;
  font-size: 0.82rem;
  font-weight: 600;
}

.wireframe-step-chip-active {
  border-color: #7a5cff;
  background: #efeaff;
  color: #2f245d;
}

.wireframe-preview-grid {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.wireframe-preview-panel {
  border: 1px solid #e7e3f3;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.9);
  padding: 18px;
  box-shadow: 0 18px 42px rgba(24, 29, 58, 0.05);
}

.wireframe-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.wireframe-panel-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f1ecff;
  color: #5a3ff0;
  font-size: 0.78rem;
  font-weight: 700;
}

.wire-mobile-frame {
  margin: 0 auto;
  max-width: 355px;
  border: 1px solid #1b1c26;
  border-radius: 34px;
  background: #ffffff;
  padding: 12px;
  box-shadow: 0 18px 38px rgba(27, 32, 52, 0.1);
}

.wire-mobile-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 4px 10px;
  color: #656980;
}

.wire-mobile-topbar-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e4e0f1;
  border-radius: 999px;
  background: #ffffff;
  color: #4b5067;
}

.wire-mobile-topbar-back:disabled {
  opacity: 0.35;
}

.wire-mobile-topbar-progress {
  flex: 1;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
}

.wire-mobile-topbar-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #6d4cff;
}

.wire-mobile-body {
  border: 1px solid #ece8f6;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff 0%, #fcfbff 100%);
  padding: 16px;
}

.wire-mobile-heading h3 {
  margin: 6px 0 0;
  font-size: 1.5rem;
  line-height: 1.1;
  color: #171825;
}

.wire-mobile-subtitle {
  margin: 8px 0 0;
  color: #5f637a;
  font-size: 0.92rem;
  line-height: 1.45;
}

.wire-mobile-highlight-stack,
.wire-desktop-highlight-stack,
.wire-mobile-list,
.wire-mobile-status-groups,
.wire-desktop-stage-stack,
.wire-desktop-status-columns {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.wire-mobile-highlight-card,
.wire-desktop-highlight-card {
  display: grid;
  gap: 4px;
  border: 1px solid #dfd7fb;
  border-radius: 18px;
  background: #f8f3ff;
  padding: 14px;
}

.wire-mobile-highlight-card strong,
.wire-desktop-highlight-card strong {
  color: #2a2453;
  font-size: 0.96rem;
}

.wire-mobile-highlight-card span,
.wire-desktop-highlight-card span {
  color: #5b5f77;
  font-size: 0.86rem;
  line-height: 1.45;
}

.wire-mobile-card,
.wire-mobile-list-item,
.wire-mobile-primary-cta,
.wire-mobile-secondary-cta,
.wire-desktop-nav-item,
.wire-desktop-stage-card,
.wire-desktop-primary-cta,
.wire-desktop-secondary-cta,
.wire-desktop-trail-item {
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}

.wire-mobile-card:hover,
.wire-mobile-list-item:hover,
.wire-mobile-primary-cta:hover,
.wire-mobile-secondary-cta:hover,
.wire-desktop-nav-item:hover,
.wire-desktop-stage-card:hover,
.wire-desktop-primary-cta:hover,
.wire-desktop-secondary-cta:hover,
.wire-desktop-trail-item:hover {
  transform: translateY(-1px);
}

.wire-mobile-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 14px;
  padding: 18px 16px;
  border: 1px solid #ddd8f4;
  border-radius: 20px;
  background: #ffffff;
  text-align: left;
}

.wire-mobile-card strong {
  font-size: 1.04rem;
  color: #181927;
}

.wire-mobile-card-primary {
  border-color: #7a5cff;
  background: #f5f0ff;
}

.wire-mobile-card-secondary {
  background: #fafafa;
}

.wire-mobile-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 15px;
  border: 1px solid #ddd8f4;
  border-radius: 18px;
  background: #ffffff;
  text-align: left;
  font-size: 0.96rem;
  font-weight: 600;
  color: #252739;
}

.wire-mobile-list-item-rich {
  align-items: flex-start;
}

.wire-mobile-list-copy {
  display: grid;
  gap: 4px;
}

.wire-mobile-list-copy strong {
  color: #1e2031;
  font-size: 0.98rem;
}

.wire-mobile-list-copy span {
  color: #666a81;
  font-size: 0.84rem;
  font-weight: 500;
}

.wire-mobile-status-groups h4,
.wire-desktop-status-columns h4 {
  margin: 0 0 6px;
  color: #696d84;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wire-mobile-question-card,
.wire-mobile-response-card,
.wire-mobile-form-summary,
.wire-desktop-form-card,
.wire-desktop-question-card,
.wire-desktop-response-card {
  margin-top: 16px;
  border: 1px solid #e3deef;
  border-radius: 20px;
  background: #ffffff;
  padding: 16px;
}

.wire-mobile-option-row,
.wire-desktop-option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  color: #26283b;
  font-size: 0.96rem;
}

.wire-mobile-radio {
  width: 16px;
  height: 16px;
  border: 1.6px solid #8b7fe6;
  border-radius: 999px;
  background: #ffffff;
}

.wire-mobile-primary-cta,
.wire-desktop-primary-cta {
  width: 100%;
  margin-top: 16px;
  padding: 14px 18px;
  border: 0;
  border-radius: 18px;
  background: #6d4cff;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
}

.wire-mobile-secondary-cta,
.wire-desktop-secondary-cta {
  width: 100%;
  margin-top: 10px;
  padding: 13px 18px;
  border: 1px solid #d9d4ec;
  border-radius: 18px;
  background: #ffffff;
  color: #3d4055;
  font-size: 0.92rem;
  font-weight: 700;
}

.wire-mobile-decision {
  margin-top: 18px;
}

.wire-mobile-decision p {
  margin: 0;
  color: #2a2c40;
  font-size: 0.92rem;
  font-weight: 700;
}

.wire-mobile-footnote,
.wire-desktop-note {
  margin: 12px 2px 0;
  color: #676c84;
  font-size: 0.84rem;
  line-height: 1.5;
}

.wire-mobile-summary-row,
.wire-desktop-form-summary-row {
  padding: 12px 14px;
  border: 1px solid #ebe7f6;
  border-radius: 16px;
  background: #faf9ff;
  color: #44485f;
  font-size: 0.88rem;
  line-height: 1.45;
}

.wire-mobile-form-summary,
.wire-desktop-form-card {
  display: grid;
  gap: 10px;
}

.wire-mobile-textarea,
.wire-desktop-textarea {
  min-height: 118px;
  border: 1px dashed #d2caec;
  border-radius: 18px;
  background: #fcfbff;
  padding: 14px;
  color: #70748c;
  font-size: 0.9rem;
  line-height: 1.55;
}

.wire-mobile-upload-card {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  border: 1px solid #e0daf2;
  border-radius: 18px;
  background: #ffffff;
  padding: 14px;
}

.wire-mobile-upload-card strong {
  color: #222538;
  font-size: 0.94rem;
}

.wire-mobile-upload-card span {
  color: #6b7088;
  font-size: 0.84rem;
  line-height: 1.45;
}

.wire-mobile-upload-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border: 1px dashed #bfb5e7;
  border-radius: 14px;
  background: #faf7ff;
  color: #4e3ac6;
  font-size: 0.86rem;
  font-weight: 700;
}

.wire-mobile-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: #fff7ea;
  color: #9b5b00;
  font-size: 0.84rem;
  font-weight: 700;
}

.wire-mobile-timeline,
.wire-desktop-timeline {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.wire-mobile-timeline-item {
  height: 54px;
  border: 1px solid #e5e0f3;
  border-radius: 18px;
  background: #ffffff;
}

.wire-desktop-frame {
  display: grid;
  grid-template-columns: 160px minmax(0, 1.45fr) 210px;
  gap: 16px;
  min-height: 760px;
  border: 1px solid #e0dbf1;
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #faf9ff 100%);
  padding: 18px;
}

.wire-desktop-sidebar,
.wire-desktop-center,
.wire-desktop-support {
  border: 1px solid #efeaf9;
  border-radius: 22px;
}

.wire-desktop-sidebar {
  background: rgba(255, 255, 255, 0.7);
  padding: 16px 12px;
}

.wire-desktop-brand {
  font-size: 1rem;
  font-weight: 700;
  color: #393d52;
}

.wire-desktop-nav {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.wire-desktop-nav-item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  color: #4e5268;
  font-size: 0.9rem;
  font-weight: 700;
}

.wire-desktop-nav-item-active {
  border-color: #d8d1f2;
  background: rgba(109, 76, 255, 0.08);
  color: #2e2457;
}

.wire-desktop-center {
  background: #ffffff;
  padding: 28px;
  box-shadow: 0 18px 40px rgba(27, 30, 48, 0.06);
}

.wire-desktop-stage-header h3 {
  margin: 6px 0 0;
  color: #171825;
  font-size: 1.84rem;
  line-height: 1.12;
}

.wire-desktop-stage-header p {
  margin: 8px 0 0;
  max-width: 560px;
  color: #61657c;
  font-size: 0.94rem;
  line-height: 1.5;
}

.wire-desktop-stage-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  padding: 16px 18px;
  border: 1px solid #e1ddef;
  border-radius: 20px;
  background: #ffffff;
  text-align: left;
}

.wire-desktop-stage-card strong,
.wire-desktop-stage-card span {
  color: #222437;
  font-size: 1rem;
}

.wire-desktop-stage-card-primary {
  border-color: #7a5cff;
  background: #f4efff;
}

.wire-desktop-stage-card-list {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.wire-desktop-choice-copy {
  display: grid;
  gap: 4px;
}

.wire-desktop-choice-copy strong {
  color: #1d2031;
  font-size: 0.98rem;
}

.wire-desktop-choice-copy small {
  color: #686d84;
  font-size: 0.82rem;
  font-weight: 500;
}

.wire-desktop-decision-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.wire-desktop-decision-row .wire-desktop-primary-cta,
.wire-desktop-decision-row .wire-desktop-secondary-cta {
  flex: 1 1 280px;
  width: auto;
  margin-top: 0;
}

.wire-desktop-detail-header {
  margin-top: 18px;
}

.wire-desktop-support {
  background: rgba(252, 251, 255, 0.74);
  padding: 16px 14px;
}

.wire-desktop-trail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.wire-desktop-trail-item {
  border: 1px solid #ddd8f0;
  border-radius: 999px;
  background: #ffffff;
  padding: 8px 10px;
  color: #4d5268;
  font-size: 0.8rem;
  font-weight: 700;
}

.wire-desktop-support-item {
  margin-top: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #ece7f7;
  color: #666b82;
  font-size: 0.84rem;
  line-height: 1.45;
}

.wire-desktop-support-item:last-child {
  border-bottom: 0;
}

@media (max-width: 1100px) {
  .wireframe-preview-grid {
    grid-template-columns: 1fr;
  }

  .wire-desktop-frame {
    grid-template-columns: 150px minmax(0, 1fr) 190px;
  }
}

@media (max-width: 820px) {
  .wire-student-page {
    padding: 20px 14px 32px;
  }

  .wireframe-header h1,
  .wireframe-preview-head h2 {
    font-size: 1.58rem;
  }

  .wire-desktop-frame {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .wire-desktop-sidebar,
  .wire-desktop-support {
    order: 2;
  }

  .wire-desktop-center {
    order: 1;
    padding: 22px;
  }
}
</style>
