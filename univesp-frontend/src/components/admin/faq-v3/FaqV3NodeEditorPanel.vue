<script setup>
import { inject } from 'vue'
import { RouterLink } from 'vue-router'

import FaqV3ContentBlockList from './FaqV3ContentBlockList.vue'
import { FAQ_V3_NODE_EDITOR_KEY } from './faqV3NodeEditorContext'

const editor = inject(FAQ_V3_NODE_EDITOR_KEY)
if (!editor) {
  throw new Error('FaqV3NodeEditorPanel requires FAQ_V3_NODE_EDITOR_KEY')
}

const selectedNode = editor.selectedNode
const canEdit = editor.canEdit
const activeTab = editor.activeTab
const editorTabs = editor.editorTabs
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
const effectiveOperationalValue = editor.effectiveOperationalValue
const resolveFinalArea = editor.resolveFinalArea
const routingKeyLabel = editor.routingKeyLabel
const tabButtonId = editor.tabButtonId
const tabPanelId = editor.tabPanelId
const bundleOperationalDefaults = editor.bundleOperationalDefaults

function criticalityLabel(key) {
  const match = runtimeParameters.criticalityLevels.find((item) => item.key === key)
  return match?.label || key || '—'
}

function slaLabel(key) {
  const match = runtimeParameters.slaLevels.find((item) => item.key === key)
  return match?.label || key || '—'
}

function areaLabel(key) {
  const match = adminAreas.value.find((item) => item.value === key)
  return match?.label || key || '—'
}

function routingSummary(node) {
  if (!node || node.node_kind !== 'final') return null
  const criticidade = effectiveOperationalValue(node, 'criticidade')
  const sla = effectiveOperationalValue(node, 'sla_policy_key')
  const area = resolveFinalArea(node)
  const override = node.operational?.routing_override
  return {
    criticidade: criticalityLabel(criticidade),
    sla: slaLabel(sla),
    area: area ? areaLabel(area) : 'Não definida',
    fila: override ? routingKeyLabel(override) : routingKeyLabel(null),
  }
}
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

    <nav class="faq-tabs" role="tablist" aria-label="Camadas da etapa">
      <button
        v-for="tab in editorTabs"
        :id="tabButtonId(tab.key)"
        :key="tab.key"
        type="button"
        role="tab"
        class="faq-tabs__button"
        :class="{ 'is-active': activeTab === tab.key, 'has-issue': tabStateLabel(tab.key).startsWith('Pendente') }"
        :aria-selected="activeTab === tab.key"
        :aria-controls="tabPanelId(tab.key)"
        :disabled="tab.key === 'document' && selectedNode.node_kind !== 'final'"
        @click="activeTab = tab.key"
      >
        <span>{{ tab.label }}</span>
        <small class="faq-tabs__state" aria-hidden="true">{{ tabStateLabel(tab.key) }}</small>
      </button>
    </nav>

    <div
      v-if="activeTab === 'student'"
      :id="tabPanelId('student')"
      role="tabpanel"
      :aria-labelledby="tabButtonId('student')"
      class="faq-form-stack"
    >
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

    <div
      v-else-if="activeTab === 'public'"
      :id="tabPanelId('public')"
      role="tabpanel"
      :aria-labelledby="tabButtonId('public')"
      class="faq-form-stack"
    >
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

    <div
      v-else-if="['op', 'bpo', 'analyst'].includes(activeTab)"
      :id="tabPanelId(activeTab)"
      role="tabpanel"
      :aria-labelledby="tabButtonId(activeTab)"
      class="faq-form-stack"
    >
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

    <div
      v-else-if="activeTab === 'routing'"
      :id="tabPanelId('routing')"
      role="tabpanel"
      :aria-labelledby="tabButtonId('routing')"
      class="faq-form-stack"
    >
      <template v-if="selectedNode.node_kind === 'final'">
        <section v-if="routingSummary(selectedNode)" class="crm-card-muted faq-routing-summary" aria-label="Resumo do encaminhamento">
          <h3 class="faq-routing-summary__title">Resumo do encaminhamento</h3>
          <dl class="faq-routing-summary__list">
            <div><dt>Criticidade</dt><dd>{{ routingSummary(selectedNode).criticidade }}</dd></div>
            <div><dt>Prazo (SLA)</dt><dd>{{ routingSummary(selectedNode).sla }}</dd></div>
            <div><dt>Área</dt><dd>{{ routingSummary(selectedNode).area }}</dd></div>
            <div><dt>Fila prevista</dt><dd>{{ routingSummary(selectedNode).fila }}</dd></div>
          </dl>
          <p class="faq-routing-summary__hint">
            Padrão do fluxo: criticidade
            {{ criticalityLabel(bundleOperationalDefaults.criticidade) }}, prazo
            {{ slaLabel(bundleOperationalDefaults.sla_policy_key) }}.
            Altere em <strong>Configurações do fluxo</strong>.
          </p>
        </section>
        <p class="faq-inheritance">
          Estes campos orientam a abertura do protocolo quando o aluno chega nesta resposta final.
          Deixe em branco para usar o padrão do fluxo.
        </p>
        <p v-if="!adminAreas.length" class="faq-area-banner" role="status">
          Nenhuma área disponível no catálogo institucional.
          <RouterLink to="/admin/permissoes?tab=areas">Cadastre em Pessoas e acessos → Áreas</RouterLink>
          e atribua em <RouterLink to="/admin/permissoes">Usuários → pessoa → Áreas</RouterLink>.
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
        <p class="faq-field-hint">
          Caminho operacional: {{ selectedPattern?.steps?.join(' → ') || 'defina em Configurações do fluxo' }}.
          A fila exata é confirmada pelo servidor ao abrir o protocolo.
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
        <label class="crm-field-label">
          Fila fixa (opcional)
          <select
            v-model="selectedNode.operational.routing_override"
            class="crm-field"
            :disabled="!canEdit"
          >
            <option :value="null">Usar regra automática do fluxo</option>
            <option v-for="key in allowedRoutingKeys" :key="key" :value="key">
              {{ routingKeyLabel(key) }}
            </option>
          </select>
        </label>
        <p class="faq-field-hint">
          Use fila fixa só quando esta resposta sempre deve ir para a mesma fila.
          Não altera criticidade nem prazo (SLA).
        </p>
      </template>
      <template v-else>
        <p>Encaminhamento detalhado fica nas respostas finais do fluxo.</p>
        <label class="crm-field-label">
          Fila fixa (opcional)
          <select
            v-model="selectedNode.operational.routing_override"
            class="crm-field"
            :disabled="!canEdit"
          >
            <option :value="null">Usar regra automática do fluxo</option>
            <option v-for="key in allowedRoutingKeys" :key="key" :value="key">
              {{ routingKeyLabel(key) }}
            </option>
          </select>
        </label>
      </template>
    </div>

    <div
      v-else-if="activeTab === 'document'"
      :id="tabPanelId('document')"
      role="tabpanel"
      :aria-labelledby="tabButtonId('document')"
      class="faq-form-stack"
    >
      <p>Configure se o aluno deve enviar documentos ao abrir o atendimento nesta resposta final.</p>
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

.faq-form-stack {
  display: grid;
  gap: var(--space-3);
}

.faq-textarea {
  min-height: 8rem;
}

.faq-inheritance {
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faq-routing-summary {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
}

.faq-routing-summary__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.faq-routing-summary__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.faq-routing-summary__list div {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: var(--space-2);
}

.faq-routing-summary__list dt {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.faq-routing-summary__list dd {
  margin: 0;
}

.faq-routing-summary__hint,
.faq-field-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-area-banner {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning, #ed6c02) 12%, var(--color-surface));
}

.faq-public-toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
