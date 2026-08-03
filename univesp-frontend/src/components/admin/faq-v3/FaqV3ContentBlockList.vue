<script setup>
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'

import { FAQ_V3_NODE_EDITOR_KEY } from './faqV3NodeEditorContext'

const props = defineProps({
  layer: {
    type: String,
    required: true,
    validator: (value) => ['student', 'public'].includes(value),
  },
  emptyTitle: { type: String, default: 'Esta etapa ainda não possui orientação.' },
  emptyHint: {
    type: String,
    default: 'Comece adicionando um texto ou outro tipo de conteúdo abaixo.',
  },
  showFinalAnswerField: { type: Boolean, default: false },
})

const editor = inject(FAQ_V3_NODE_EDITOR_KEY)
if (!editor) {
  throw new Error('FaqV3ContentBlockList requires FAQ_V3_NODE_EDITOR_KEY')
}

const selectedNode = editor.selectedNode
const canEdit = editor.canEdit
const BLOCK_TYPE_LABELS = editor.BLOCK_TYPE_LABELS
const contentBlocks = editor.contentBlocks
const addContentBlock = editor.addContentBlock
const removeContentBlock = editor.removeContentBlock
const moveContentBlock = editor.moveContentBlock
const setOutcome = editor.setOutcome
const mediaUploadEnabled = editor.mediaUploadEnabled
const assetBusy = editor.assetBusy
const uploadBlockAsset = editor.uploadBlockAsset
const readBlockCount = editor.readBlockCount

const BLOCK_TYPE_HINTS = {
  text: 'Parágrafo de orientação normal.',
  notice: 'Destaque visual de atenção — use para alertas importantes.',
  link: 'Link externo com rótulo clicável.',
  file: 'Documento institucional referenciado por link.',
  image: 'Imagem por URL ou upload institucional.',
  video: 'Vídeo por URL, com legenda e transcrição quando possível.',
  animation: 'GIF ou animação com texto alternativo.',
  button: 'Ação fixa do sistema (abrir atendimento ou ir para login).',
}

const PRIMARY_BLOCK_ACTIONS = [
  { type: 'text', label: 'Texto', hint: BLOCK_TYPE_HINTS.text },
  { type: 'notice', label: 'Aviso', hint: BLOCK_TYPE_HINTS.notice },
  { type: 'link', label: 'Link ou documento', hint: 'Link externo ou PDF institucional (marque o tipo ao editar).' },
]

const MEDIA_BLOCK_TYPES = [
  { type: 'image', label: 'Imagem' },
  { type: 'video', label: 'Vídeo' },
  { type: 'animation', label: 'Animação acessível' },
]

const CONTROLLED_ACTIONS = [
  { type: 'button', actionKey: 'open_ticket', label: 'Botão: Abrir atendimento' },
  { type: 'button', actionKey: 'go_login', label: 'Botão: Ir para login do aluno' },
]

const mediaMenuOpen = ref(false)
const actionsMenuOpen = ref(false)
const mediaMenuTrigger = ref(null)
const mediaMenuPanel = ref(null)
const actionsMenuTrigger = ref(null)
const actionsMenuPanel = ref(null)

function blocks() {
  return contentBlocks(props.layer)
}

function blockCount() {
  return readBlockCount(selectedNode.value, props.layer)
}

function addBlock(type, actionKey = null) {
  addContentBlock(props.layer, type, actionKey)
  closeMenus()
}

function addControlledButton(actionKey) {
  addContentBlock(props.layer, 'button', actionKey)
  closeMenus()
}

function toggleMenu(menu) {
  if (menu === 'media') {
    mediaMenuOpen.value = !mediaMenuOpen.value
    actionsMenuOpen.value = false
    return
  }
  if (menu === 'actions') {
    actionsMenuOpen.value = !actionsMenuOpen.value
    mediaMenuOpen.value = false
    return
  }
}

function closeMenus() {
  mediaMenuOpen.value = false
  actionsMenuOpen.value = false
}

function setLinkOrFileType(block, asFile) {
  block.type = asFile ? 'file' : 'link'
}

function handleDocumentPointerDown(event) {
  const targets = [
    mediaMenuPanel.value,
    mediaMenuTrigger.value,
    actionsMenuPanel.value,
    actionsMenuTrigger.value,
  ]
  if (targets.some((node) => node?.contains(event.target))) return
  closeMenus()
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown))
</script>

<template>
  <div class="faq-content-blocks">
    <div v-if="!blockCount()" class="faq-empty-tab crm-card-muted">
      <p>{{ emptyTitle }}</p>
      <p>{{ emptyHint }}</p>
    </div>

    <ol v-else class="faq-blocks" :aria-label="`Conteúdo da camada ${layer}`">
      <li
        v-for="(block, index) in blocks()"
        :key="block.block_id"
        class="crm-card-muted faq-block"
      >
        <div class="faq-block__header">
          <span class="crm-chip faq-block__type">{{ BLOCK_TYPE_LABELS[block.type] || block.type }}</span>
          <div class="faq-block__actions">
            <button
              type="button"
              class="crm-button-secondary"
              :disabled="!canEdit || index === 0"
              :aria-label="`Mover item ${index + 1} para cima`"
              @click="moveContentBlock(layer, index, -1)"
            >
              Subir
            </button>
            <button
              type="button"
              class="crm-button-secondary"
              :disabled="!canEdit || index === blocks().length - 1"
              :aria-label="`Mover item ${index + 1} para baixo`"
              @click="moveContentBlock(layer, index, 1)"
            >
              Descer
            </button>
            <button
              type="button"
              class="crm-button-secondary"
              :disabled="!canEdit"
              :aria-label="`Excluir item ${index + 1}`"
              @click="removeContentBlock(layer, index)"
            >
              Excluir
            </button>
          </div>
        </div>

        <label v-if="['text', 'notice'].includes(block.type)" class="crm-field-label">
          Conteúdo
          <textarea
            :id="
              showFinalAnswerField && index === 0 && selectedNode?.node_kind === 'final'
                ? 'faq-field-final-answer'
                : undefined
            "
            v-model="block.body"
            class="crm-field faq-textarea"
            :disabled="!canEdit"
          />
        </label>

        <template v-else-if="block.type === 'button'">
          <label class="crm-field-label">
            Texto do botão
            <input v-model="block.body" class="crm-field" :disabled="!canEdit" />
          </label>
          <label class="crm-field-label">
            Ação controlada
            <select v-model="block.action_key" class="crm-field" :disabled="!canEdit">
              <option value="open_ticket">Abrir atendimento</option>
              <option value="go_login">Ir para login do aluno (tela /login)</option>
            </select>
          </label>
          <p class="faq-block-hint">{{ BLOCK_TYPE_HINTS.button }}</p>
        </template>

        <template v-else>
          <p v-if="BLOCK_TYPE_HINTS[block.type]" class="faq-block-hint">{{ BLOCK_TYPE_HINTS[block.type] }}</p>
          <label
            v-if="mediaUploadEnabled && ['image', 'video'].includes(block.type)"
            class="crm-field-label"
          >
            Enviar mídia institucional
            <input
              type="file"
              :accept="
                block.type === 'image'
                  ? 'image/png,image/jpeg,image/webp,image/gif'
                  : 'video/mp4,video/webm'
              "
              :disabled="!canEdit || assetBusy"
              @change="uploadBlockAsset(layer, block, $event)"
            />
          </label>
          <label class="crm-field-label">
            Endereço HTTPS
            <input v-model="block.url" type="url" class="crm-field" :disabled="!canEdit" />
          </label>
          <label v-if="['link', 'file'].includes(block.type)" class="crm-field-label">
            Texto exibido
            <input v-model="block.body" class="crm-field" :disabled="!canEdit" />
          </label>
          <label v-if="block.type === 'link' || block.type === 'file'" class="faq-link-type-toggle">
            <input
              type="checkbox"
              :checked="block.type === 'file'"
              :disabled="!canEdit"
              @change="setLinkOrFileType(block, $event.target.checked)"
            />
            Documento institucional (PDF ou arquivo oficial)
          </label>
          <label v-if="['image', 'animation'].includes(block.type)" class="crm-field-label">
            Texto alternativo
            <input v-model="block.alt" class="crm-field" :disabled="!canEdit" />
          </label>
          <label v-if="block.type === 'video'" class="crm-field-label">
            URL da legenda
            <input
              v-model="block.captions_url"
              type="url"
              class="crm-field"
              :disabled="!canEdit"
            />
          </label>
          <label v-if="block.type === 'video'" class="crm-field-label">
            Transcrição
            <textarea
              v-model="block.transcript"
              class="crm-field faq-textarea"
              :disabled="!canEdit"
            />
          </label>
        </template>
      </li>
    </ol>

    <div class="faq-content-blocks__add-bar" role="group" aria-label="Adicionar conteúdo">
      <button
        v-for="item in PRIMARY_BLOCK_ACTIONS"
        :key="item.type"
        type="button"
        class="crm-button-secondary"
        :title="item.hint"
        :disabled="!canEdit"
        @click="addBlock(item.type)"
      >
        + {{ item.label }}
      </button>
      <div class="faq-menu">
        <button
          ref="mediaMenuTrigger"
          type="button"
          class="crm-button-secondary"
          aria-haspopup="menu"
          :aria-expanded="mediaMenuOpen"
          :disabled="!canEdit"
          @click="toggleMenu('media')"
        >
          + Mídia
        </button>
        <div v-if="mediaMenuOpen" ref="mediaMenuPanel" class="faq-menu__panel" role="menu">
          <button
            v-for="item in MEDIA_BLOCK_TYPES"
            :key="item.type"
            type="button"
            role="menuitem"
            class="faq-menu__item"
            @click="addBlock(item.type)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
      <div class="faq-menu">
        <button
          ref="actionsMenuTrigger"
          type="button"
          class="crm-button-secondary"
          aria-haspopup="menu"
          :aria-expanded="actionsMenuOpen"
          :disabled="!canEdit"
          @click="toggleMenu('actions')"
        >
          + Ações
        </button>
        <div v-if="actionsMenuOpen" ref="actionsMenuPanel" class="faq-menu__panel" role="menu">
          <button
            v-for="item in CONTROLLED_ACTIONS"
            :key="item.actionKey"
            type="button"
            role="menuitem"
            class="faq-menu__item"
            @click="addControlledButton(item.actionKey)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <label v-if="showFinalAnswerField && selectedNode?.node_kind === 'final'" class="crm-field-label">
      Resultado esperado
      <input
        class="crm-field"
        :value="selectedNode.content?.[layer]?.outcome_key || ''"
        :disabled="!canEdit"
        placeholder="Ex.: resolveu ou abrir_atendimento"
        @input="setOutcome(layer, $event.target.value)"
      />
    </label>
  </div>
</template>

<style scoped>
.faq-content-blocks {
  display: grid;
  gap: var(--space-3);
}

.faq-empty-tab {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
}

.faq-blocks,
.faq-block {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.faq-block__header,
.faq-block__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.faq-block__type {
  font-weight: 700;
}

.faq-block-hint,
.faq-link-type-toggle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-link-type-toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.faq-textarea {
  min-height: 8rem;
}

.faq-content-blocks__add-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.faq-menu {
  position: relative;
}

.faq-menu__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 35;
  display: grid;
  gap: var(--space-1);
  min-width: 12rem;
  padding: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md, 0 0.5rem 1rem rgba(0, 0, 0, 0.12));
}

.faq-menu__item {
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  text-align: start;
}

.faq-menu__item:hover:not(:disabled) {
  background: var(--color-surface-muted);
}
</style>
