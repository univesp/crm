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

const DIRECT_BLOCK_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'link', label: 'Link' },
  { type: 'image', label: 'Imagem' },
  { type: 'video', label: 'Vídeo' },
]

const MORE_BLOCK_TYPES = [
  { type: 'notice', label: 'Aviso' },
  { type: 'button', label: 'Botão controlado' },
  { type: 'file', label: 'Arquivo institucional' },
  { type: 'animation', label: 'Animação acessível' },
]

const moreTypesOpen = ref(false)
const moreTypesTrigger = ref(null)
const moreTypesPanel = ref(null)

function blocks() {
  return contentBlocks(props.layer)
}

function blockCount() {
  return readBlockCount(selectedNode.value, props.layer)
}

function addBlock(type) {
  addContentBlock(props.layer, type)
  closeMoreTypes()
}

function toggleMoreTypes() {
  moreTypesOpen.value = !moreTypesOpen.value
}

function closeMoreTypes() {
  moreTypesOpen.value = false
}

function handleDocumentPointerDown(event) {
  if (!moreTypesOpen.value) return
  const panel = moreTypesPanel.value
  const trigger = moreTypesTrigger.value
  if (panel?.contains(event.target) || trigger?.contains(event.target)) return
  closeMoreTypes()
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
              <option value="go_login">Ir para o portal do aluno</option>
            </select>
          </label>
        </template>

        <template v-else>
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
        v-for="item in DIRECT_BLOCK_TYPES"
        :key="item.type"
        type="button"
        class="crm-button-secondary"
        :disabled="!canEdit"
        @click="addBlock(item.type)"
      >
        + {{ item.label }}
      </button>
      <div class="faq-menu">
        <button
          ref="moreTypesTrigger"
          type="button"
          class="crm-button-secondary"
          aria-haspopup="menu"
          :aria-expanded="moreTypesOpen"
          :disabled="!canEdit"
          @click="toggleMoreTypes"
        >
          Mais tipos
        </button>
        <div v-if="moreTypesOpen" ref="moreTypesPanel" class="faq-menu__panel" role="menu">
          <button
            v-for="item in MORE_BLOCK_TYPES"
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
