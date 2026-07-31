# FAQ v3 — Especificação de produto e UX

Status: **v3** — pacote corretivo 2026-07 (árvore única, mapa Vue Flow, simulador, publicação Admin direta).
Documentos relacionados: [FAQ_V3_EXECUTION_SPEC.md](./FAQ_V3_EXECUTION_SPEC.md), [FAQ_V3_PRIVACY_OPERATIONS.md](./FAQ_V3_PRIVACY_OPERATIONS.md), [FAQ_V3_BACKLOG.md](./FAQ_V3_BACKLOG.md).

> **Nota histórica:** versões anteriores descreviam “Tipo de FAQ” e prévia baseada no nó selecionado. Substituídas pela regra de canais + mapa/simulador.

---

## 1. Escopo

Este documento fixa **interface, jornada e comportamento percebido**. Contratos técnicos (schema, API, DocTypes) estão na spec de execução.

### Fora de escopo

- Implementação de código
- Parecer jurídico; este documento aplica os controles técnicos definidos em
  PRIVACY_OPERATIONS sem criar bloqueio externo

---

## 2. Princípios UX (herdados)

- Clareza antes de densidade (`docs/UX_PRINCIPLES_CRM.md`)
- Progressividade: básico claro, avançado sob demanda
- Prevenir erro de publicação
- Linguagem **portuguesa** na interface
- Componentes **`.crm-*`** do toolkit institucional (`index.css`)

---

## 3. Biblioteca (`/admin/faq`)

### 3.1 Layout

Duas telas principais: **Biblioteca** e **Editor** (sem tela separada de “publicação avançada”).
Criação de fluxo via botão **Criar fluxo** → modal (não formulário sempre aberto).

### 3.2 Colunas da tabela “Fluxos disponíveis”

| Coluna | Conteúdo |
|--------|----------|
| Tema | Nome do tema (Theme Governance) |
| **Disponível em** | Chips: Portal do Aluno · Atendimento público |
| Playbooks | Indicador: OP ✓/—, BPO ✓/—, Analista ✓/— |
| Responsável | `owner_email` do Theme Governance |
| Situação | Rascunho \| Aguardando aprovação \| Ajustes solicitados \| Publicado \| Arquivado |
| Vigência | `valid_from` – `valid_until` ou “Vigente desde …” |
| Sugestões pendentes | Contagem |
| Alertas | Conteúdo incompleto, órfãos, conflitos |
| Última atualização | Data/hora |

### 3.3 Filtros

- Situação
- Disponível em
- Tema / área
- Com sugestões pendentes
- Com alertas de validação

### 3.3b Criar tema

Admin pode **Criar novo tema** (nome, chave automática, área, responsável). Grupo aprovador opcional na criação; obrigatório ao enviar para revisão.

### 3.4 Editor — visualização

- **Mapa do fluxo** (Vue Flow + Dagre): overview; clique seleciona nó; sem drag-connect.
- **Lista de etapas**: alternativa acessível / mobile.
- **Simular jornada**: modal com estado próprio (canal, nó atual, caminho); distinto do mapa.
- **Ver playbook**: OP/BPO/Analista do nó atual.

### 3.5 Publicação

| Perfil | Ações |
|--------|-------|
| Admin | Publicar (rascunho próprio ou aprovado); Enviar para revisão (opcional) |
| Analista | Salvar rascunho; Enviar para aprovação |
| Gestor | Aprovar; Solicitar ajustes |

---

| Ação | Condição | Comportamento |
|------|----------|---------------|
| Abrir | Sempre (permissão) | Vai ao Editor |
| Duplicar | Sempre | Fork novo bundle/rascunho |
| Exportar | Sempre | JSON/XLSX com `_meta` |
| Arquivar | Bundle já publicado | Confirmação + motivo |
| Restaurar versão | Admin | Lista versões publicadas; rollback auditado |
| Excluir | **Nunca publicado** | Confirmação forte |
| Excluir | Já publicado | **Oculto/desabilitado** |

### 3.5 Estados em português (mapeamento)

| `lifecycle_state` | Label UI |
|-------------------|----------|
| `draft` | Rascunho |
| `pending_approval` | Aguardando aprovação |
| `draft` (pós-ajuste) | Ajustes solicitados |
| `published` | Publicado |
| `archived` (bundle) | Arquivado |

---

## 4. Editor do fluxo

> **Atualização 2026-07:** árvore única; modos **Mapa do fluxo** e **Lista de etapas**; **Simular jornada** (modal) substitui “Ver como a jornada funciona”; sem seletor “Árvore para público”.

### 4.1 Layout

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│ Mapa ou Lista   │ Edição do nó (centro)    │ Validação       │
│ (árvore única)  │ orientação + playbooks   │ histórico       │
└─────────────────┴──────────────────────────┴─────────────────┘
│ Simular jornada │ Ver playbook │ Salvar │ Publicar / Enviar │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 Visualização

- Mapa (Vue Flow): nós/arestas de `payload`; Dagre; clique seleciona; sem conexão livre
- Lista: navegação acessível; fallback mobile
- Sem seletor de árvore por público operacional

### 4.3 Abas do nó (centro)

| Aba | Conteúdo |
|-----|----------|
| Orientação (aluno) | Blocos + desfecho |
| Público externo | Herdar ou personalizar (`public_content_mode`) |
| OP / BPO / Analista | Playbooks no mesmo nó; BPO herda OP |
| Encaminhamento | Pattern + override |
| Documento | Política (somente final) |

### 4.4 Simular jornada

Estado próprio: `simulationChannel`, `simulationCurrentNodeId`, `simulationPath`.
Começa na raiz; avança/volta/reinicia; mostra desfecho.

### 4.5 Governança na mesma tela

- Painel direito: blockers de validação
- Comparar rascunho vs publicado (diff por `stable_key`)
- Histórico de versões e aprovações
- Vigência: campos `valid_from` / `valid_until` opcionais (sem “publicar agora” separado — publicar é ação explícita)

### 4.6 Importação no editor

- Modo Importação com diff visual: novos, alterados, movidos, órfãos, conflitantes
- Modal **“Resolver órfãos”** antes de enviar aprovação

### 4.7 Política documental (UI)

- Aba Documento **oculta** em nós `path`
- Select limitado: Desabilitado \| Opcional \| Obrigatório
- Tipos documentais: multiselect do catálogo institucional
- `max_files` / `max_size_mb`: sliders limitados ao teto institucional

---

## 5. Limpeza obrigatória (remover do builder atual)

| Remover | Motivo |
|---------|--------|
| Tela “publicação avançada” | Redundante; vigência no editor |
| Termos em inglês na UI | Padronizar português |
| Prioridade numérica, “p50”, display rank | Sem consumidor real |
| Condição especial | Sem runtime |
| Destaque/featured | Sem consumidor real |
| Botões redundantes ou sem funcionamento | Reduzir erro |
| “Testar jornada” | Renomear (seção 4.4) |

---

## 6. Consumo operacional (cockpit OP/BPO/Analista)

### 6.1 Contexto

Ao abrir atendimento com lineage FAQ, exibir painel **“Orientação do fluxo”**.

### 6.2 Conteúdo do painel

| Elemento | Fonte |
|----------|-------|
| Tema e nó percorrido pelo aluno | Lineage + título nó |
| Camada aplicável | OP / BPO / Analista conforme perfil |
| Objetivo | `playbook.objective` |
| Checklist | Itens com checkbox interativo |
| Sistemas | Links/chaves |
| Documentos a solicitar | Lista |
| Resposta sugerida | Copiável |
| Ações permitidas | Botões habilitados conforme `allowed_actions` |
| Próximo nível | Resultado do roteamento (label institucional, não nome HD Team) |
| Sugerir melhoria | Botão contextual (Fase 2; se grant) |

### 6.3 Gatilho `case.knowledge_applied`

Registrar quando operador:

- Aplica resposta sugerida no ticket, **ou**
- Marca checklist como concluído, **ou**
- Clica “Registrei uso desta orientação”

Abrir painel **não** dispara o evento.

---

## 7. Jornada pública (Fase 3+)

### 7.1 Fluxo `/publico`

1. FAQ anônima (flag `faq_public_anonymous`)
2. Navegação árvore público
3. Desfecho → formulário abertura
4. Protocolo + mensagem genérica encaminhamento

### 7.2 Tipo de vínculo (obrigatório)

| Valor | Label |
|-------|-------|
| `aluno` | Sou aluno e não consigo entrar |
| `ex_aluno` | Ex-aluno |
| `candidato` | Candidato |
| `publico_externo` | Público externo |
| `outro` | Outro |

### 7.3 Campos abertura — Fase 3

| Campo | Obrigatoriedade |
|-------|-----------------|
| Nome, e-mail pessoal, celular, tipo vínculo | Sempre na abertura |
| CPF | **Condicional** — ver política abaixo e [PRIVACY §10](./FAQ_V3_PRIVACY_OPERATIONS.md) |

CPF obrigatório somente quando o fluxo declara `intake_policy.requires_cpf` com
finalidade objetiva. Problema de acesso pode solicitá-lo quando a validação de
vínculo o exigir; dúvida geral permanece sem CPF.

### 7.4 Campos adicionais — Fase 4

RA, e-mail institucional, polo (select), curso (select filtrado por polo).

### 7.5 E-mail de contato

- Fase 3: formato válido; sem verificação
- Fase 4: **código temporário por e-mail** antes de criar protocolo (recomendado anti-fraude)

### 7.6 Upload documento antes do protocolo

Quando `document_policy.mode = required`:

1. Sessão intake temporária (`intake_session_id`) ligada a `faq_session_id`
2. Upload em **quarentena** (storage privado, não vinculado ao ticket ainda)
3. Antimalware assíncrono
4. Protocolo criado somente após scan `clean` (ou timeout com mensagem “análise em andamento”)
5. Vinculação anexo ↔ protocolo na criação
6. Upload abandonado: job descarta após TTL intake
7. Demora antimalware: UI “Documento em análise”; polling; não duplicar upload

---

## 8. Acessibilidade

- Proporcional à fase entregue
- Imagens: alt obrigatório
- Vídeos: legenda/transcrição (Fase 5)
- Navegação teclado na biblioteca e editor
- Prévia acessível (landmarks, títulos)

---

## 9. Critérios de aceite UX — Fase 1d

- [ ] Biblioteca com coluna Tipo de FAQ e filtros
- [ ] Editor duas telas; árvore + abas + prévia persona
- [ ] Itens removidos (seção 5) ausentes
- [ ] “Ver como a jornada funciona” funcional
- [ ] Vigência opcional sem publicação avançada
- [ ] Resolver órfãos antes de aprovação
- [ ] Toolkit `.crm-*` aplicado

---

## 10. Histórico

| Versão | Notas |
|--------|-------|
| v1 | Split da v4; biblioteca, editor, consumo operacional, público |
