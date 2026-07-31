<script setup>
import { inject } from 'vue'

import FaqV3ContentBlockList from './FaqV3ContentBlockList.vue'
import { FAQ_V3_NODE_EDITOR_KEY } from './faqV3NodeEditorContext'

const editor = inject(FAQ_V3_NODE_EDITOR_KEY)
if (!editor) {
  throw new Error('FaqV3NodeEditorPanel requires FAQ_V3_NODE_EDITOR_KEY')
}

const selectedNode = editor.selectedNode
const canEdit = editor.canEdit
const activeTab = editor.activeTab
const advancedOpen = editor.advancedOpen
const editorTabs = editor.editorTabs
const advancedTabSummary = editor.advancedTabSummary
const publicContentIsCustom = editor.publicContentIsCustom
const runtimeParameters = editor.runtimeParameters
const adminAreas = editor.adminAreas
const selectedPattern = editor.selectedPattern
const allowedRoutingKeys = editor.allowedRoutingKeys
const routingChainPresets = editor.ROUTING_CHAIN_PRESETS
const togglePublicCustomization = editor.togglePublicCustomization
const ensurePlaybook = editor.ensurePlaybook
const useOpPlaybook = editor.useOpPlaybook
const effectivePlaybook = editor.effectivePlaybook
const updatePlaybookField = editor.updatePlaybookField
const updatePlaybookList = editor.updatePlaybookList
const playbookList = editor.playbookList
const tabStateLabel = editor.tabStateLabel
const operationalInheritanceLabel = editor.operationalInheritanceLabel
const routingChainPresetValue = editor.routingChainPresetValue
const setRoutingChainPreset = editor.setRoutingChainPreset
</script>

<template>
  <template v-if="selectedNode">
    <div class="faq-node-editor__title">
      <label class="crm-field-label">
        Nome da etapa
        <input
          id="faq-field-title"
          v-model="selectedNode.display.title"
          class="crm-field"
          :disabled="!canEdit"
        />
      </label>
    </div>

    <nav class="faq-tabs" aria-label="Camadas da etapa">
      <button
        v-for="tab in editorTabs"
        :key="tab.key"
        type="button"
        class="faq-tabs__button"
        :class="{ 'is-active': activeTab === tab.key, 'has-issue': tabStateLabel(tab.key).includes('alerta') }"
        :disabled="tab.key === 'document' && selectedNode.node_kind !== 'final'"
        @click="activeTab = tab.key"
      >
        <span>{{ tab.label }}</span>
        <small class="faq-tabs__state" aria-hidden="true">{{ tabStateLabel(tab.key) }}</small>
      </button>
    </nav>

    <button
      v-if="!advancedOpen"
      type="button"
      class="crm-button-secondary faq-advanced-toggle"
      @click="advancedOpen = true"
    >
      Mostrar opções avançadas
      <span
        v-if="advancedTabSummary.filled || advancedTabSummary.issues"
        class="faq-advanced-toggle__meta"
      >
        ({{ advancedTabSummary.filled }} abas avançadas ·
        {{ advancedTabSummary.issues }} com pendência)
      </span>
    </button>
    <button
      v-else
      type="button"
      class="crm-button-secondary faq-advanced-toggle"
      @click="advancedOpen = false"
    >
      Ocultar opções avançadas
    </button>

    <div v-if="activeTab === 'student'" class="faq-form-stack">
      <p>
        Escreva a orientação que a pessoa verá nesta etapa. Use linguagem direta e indique
        o próximo passo.
      </p>
      <FaqV3ContentBlockList
        layer="student"
        empty-title="Esta etapa ainda não possui orientação para o aluno."
        empty-hint="Comece adicionando um texto ou outro tipo de conteúdo abaixo."
        show-final-answer-field
      />
    </div>

    <div v-else-if="activeTab === 'public'" class="faq-form-stack">
      <label class="faq-public-toggle">
        <input
          type="checkbox"
          :checked="publicContentIsCustom"
          :disabled="!canEdit"
          @change="togglePublicCustomization($event.target.checked)"
        />
        Personalizar texto para o público externo
      </label>
      <p v-if="!publicContentIsCustom" class="faq-inheritance">
        O público externo vê a mesma orientação definida na aba Orientação.
      </p>
      <template v-else>
        <p>
          Escreva uma orientação específica para quem acessa pelo atendimento público.
        </p>
        <FaqV3ContentBlockList
          layer="public"
          empty-title="Esta etapa ainda não possui orientação para o público externo."
          empty-hint="Comece adicionando um texto ou outro tipo de conteúdo abaixo."
          show-final-answer-field
        />
      </template>
    </div>

    <div v-else-if="['op', 'bpo', 'analyst'].includes(activeTab)" class="faq-form-stack">
      <div v-if="activeTab === 'bpo' && !selectedNode.playbooks?.bpo" class="faq-inheritance">
        <strong>Herdado do OP</strong>
        <p>O BPO usa a orientação do OP enquanto não houver uma personalização.</p>
        <button
          type="button"
          class="crm-button-secondary"
          :disabled="!canEdit"
          @click="ensurePlaybook('bpo')"
        >
          Personalizar para BPO
        </button>
      </div>
      <button
        v-if="activeTab === 'bpo' && selectedNode.playbooks?.bpo"
        type="button"
        class="crm-button-secondary"
        :disabled="!canEdit"
        @click="useOpPlaybook"
      >
        Usar orientação do OP
      </button>
      <label class="crm-field-label">
        Objetivo
        <textarea
          id="faq-field-op-objective"
          class="crm-field"
          :value="effectivePlaybook(activeTab).objective"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookField(activeTab, 'objective', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Checklist, um item por linha
        <textarea
          class="crm-field faq-textarea"
          :value="playbookList(activeTab, 'checklist')"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookList(activeTab, 'checklist', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Sistemas a consultar, um por linha
        <textarea
          class="crm-field"
          :value="playbookList(activeTab, 'systems')"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookList(activeTab, 'systems', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Documentos a solicitar, um por linha
        <textarea
          class="crm-field"
          :value="playbookList(activeTab, 'documents_to_request')"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookList(activeTab, 'documents_to_request', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Resposta sugerida
        <textarea
          class="crm-field faq-textarea"
          :value="effectivePlaybook(activeTab).suggested_reply"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookField(activeTab, 'suggested_reply', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Ações permitidas, uma por linha
        <textarea
          class="crm-field"
          :value="playbookList(activeTab, 'allowed_actions')"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookList(activeTab, 'allowed_actions', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Quando escalar
        <textarea
          class="crm-field"
          :value="effectivePlaybook(activeTab).escalation_criteria"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookField(activeTab, 'escalation_criteria', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Modelo do motivo do escalonamento
        <textarea
          class="crm-field"
          :value="effectivePlaybook(activeTab).escalation_reason_template"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookField(activeTab, 'escalation_reason_template', $event.target.value)"
        />
      </label>
      <label class="crm-field-label">
        Resultados possíveis, um por linha
        <textarea
          class="crm-field"
          :value="playbookList(activeTab, 'possible_outcomes')"
          :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
          @input="updatePlaybookList(activeTab, 'possible_outcomes', $event.target.value)"
        />
      </label>
    </div>

    <div v-else-if="activeTab === 'routing'" class="faq-form-stack">
      <template v-if="selectedNode.node_kind === 'final'">
        <p class="faq-inheritance">
          Criticidade, prazo e encaminhamento desta resposta final orientam a abertura do protocolo.
          Quando vazio, o fluxo usa o padrão institucional do bundle.
        </p>
        <label class="crm-field-label">
          Criticidade
          <select
            v-model="selectedNode.operational.criticidade"
            class="crm-field"
            :disabled="!canEdit"
          >
            <option :value="null">
              {{ operationalInheritanceLabel(selectedNode, 'criticidade', runtimeParameters.criticalityLevels) }}
            </option>
            <option
              v-for="level in runtimeParameters.criticalityLevels"
              :key="level.key"
              :value="level.key"
            >
              {{ level.label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Prazo (SLA)
          <select
            v-model="selectedNode.operational.sla_policy_key"
            class="crm-field"
            :disabled="!canEdit"
          >
            <option :value="null">
              {{ operationalInheritanceLabel(selectedNode, 'sla_policy_key', runtimeParameters.slaLevels) }}
            </option>
            <option v-for="level in runtimeParameters.slaLevels" :key="level.key" :value="level.key">
              {{ level.label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Área responsável
          <select
            id="faq-field-area-key"
            v-model="selectedNode.operational.area_key"
            class="crm-field"
            :disabled="!canEdit"
          >
            <option :value="null">Selecione a área</option>
            <option v-for="area in adminAreas" :key="area.value" :value="area.value">
              {{ area.label }}
            </option>
          </select>
        </label>
        <label class="crm-field-label">
          Cadeia de atendimento
          <select
            class="crm-field"
            :disabled="!canEdit"
            :value="routingChainPresetValue(selectedNode.operational.routing_chain)"
            @change="setRoutingChainPreset($event.target.value)"
          >
            <option
              v-for="preset in routingChainPresets"
              :key="preset.value || 'default'"
              :value="preset.value"
            >
              {{ preset.label }}
            </option>
          </select>
        </label>
        <p>
          {{ selectedPattern?.steps?.join(' → ') || 'Selecione um caminho no fluxo.' }}
          O servidor confirma a fila real ao abrir o protocolo.
        </p>
        <label class="crm-field-label">
          Pessoa específica (opcional)
          <input
            v-model="selectedNode.operational.assignee_email"
            type="email"
            class="crm-field"
            :disabled="!canEdit"
            placeholder="email@univesp.br"
          />
        </label>
      </template>
      <template v-else>
        <p>Encaminhamento operacional detalhado fica nas respostas finais do fluxo.</p>
      </template>
      <label class="crm-field-label">
        Exceção para esta etapa
        <select
          v-model="selectedNode.operational.routing_override"
          class="crm-field"
          :disabled="!canEdit"
        >
          <option :value="null">Usar regra do fluxo</option>
          <option v-for="key in allowedRoutingKeys" :key="key" :value="key">
            {{ key }}
          </option>
        </select>
      </label>
    </div>

    <div v-else-if="activeTab === 'document'" class="faq-form-stack">
      <p>O upload aparece somente nesta resposta final.</p>
      <label class="crm-field-label">
        Envio de documento pelo aluno
        <select
          id="faq-field-document-mode"
          v-model="selectedNode.document_policy.mode"
          class="crm-field"
          :disabled="!canEdit"
        >
          <option value="disabled">Desabilitado</option>
          <option value="optional">Opcional</option>
          <option value="required">Obrigatório</option>
        </select>
      </label>
      <fieldset class="crm-card-muted faq-form-stack">
        <legend>Dados pedidos ao abrir atendimento</legend>
        <p>Nome, e-mail e celular são sempre pedidos. Marque somente o que esta resposta exige.</p>
        <label>
          <input v-model="selectedNode.intake_policy.requires_cpf" type="checkbox" :disabled="!canEdit" />
          Solicitar CPF
        </label>
        <label v-if="selectedNode.intake_policy.requires_cpf" class="crm-field-label">
          Finalidade objetiva do CPF
          <textarea
            id="faq-field-cpf-purpose"
            v-model="selectedNode.intake_policy.cpf_purpose"
            class="crm-field faq-textarea"
            :disabled="!canEdit"
            placeholder="Explique por que este fluxo precisa confirmar o CPF."
          />
        </label>
        <label>
          <input v-model="selectedNode.intake_policy.requires_ra" type="checkbox" :disabled="!canEdit" />
          Solicitar RA
        </label>
        <label>
          <input v-model="selectedNode.intake_policy.requires_course" type="checkbox" :disabled="!canEdit" />
          Solicitar curso
        </label>
        <label>
          <input v-model="selectedNode.intake_policy.requires_polo" type="checkbox" :disabled="!canEdit" />
          Solicitar polo
        </label>
      </fieldset>
    </div>
  </template>
</template>

<style scoped>
.faq-node-editor__title {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: end;
  justify-content: space-between;
}

.faq-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-block: var(--space-3);
  border-bottom: 1px solid var(--border-default);
}

.faq-tabs__button {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
  min-height: 2.75rem;
  border-bottom: 3px solid transparent;
  padding-inline: var(--space-3);
  white-space: nowrap;
}

.faq-tabs__button.is-active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 700;
}

.faq-tabs__state {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.faq-tabs__button.has-issue .faq-tabs__state {
  color: var(--color-danger);
}

.faq-advanced-toggle {
  margin-block: var(--space-2);
}

.faq-advanced-toggle__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-form-stack {
  display: grid;
  gap: var(--space-3);
}

.faq-textarea {
  min-height: 8rem;
}

.faq-inheritance {
  border-left: 4px solid var(--color-primary);
  background: var(--color-surface-muted);
  padding: var(--space-3);
}

.faq-public-toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
