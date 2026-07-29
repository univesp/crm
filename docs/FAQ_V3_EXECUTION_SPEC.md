# FAQ v3 — Especificação de execução (técnica)

Status: **v6** — implementação das Fases 0–5 concluída localmente; ativação e
evidência transacional aguardam deploy em homolog.
Documentos relacionados:

- [FAQ_V3_PRODUCT_UX_SPEC.md](./FAQ_V3_PRODUCT_UX_SPEC.md) — Biblioteca, editor, consumo operacional (Fase 1d)
- [FAQ_V3_PRIVACY_OPERATIONS.md](./FAQ_V3_PRIVACY_OPERATIONS.md) — LGPD, retenção, runbooks, métricas, operação
- [FAQ_V3_BACKLOG.md](./FAQ_V3_BACKLOG.md) — Fases, histórias, integrações e gates

**Encaminhamento:** implementação iniciada na worktree isolada e branch `codex/faq-v3-phase0`.

---

## 1. Maturidade honesta

| Parte | Situação |
|-------|----------|
| Fase 0 | Implementada; gate remoto executado no deploy |
| Fases 1a–1c | Implementadas; contratos e testes locais concluídos |
| Fase 1d | Implementada conforme [FAQ_V3_PRODUCT_UX_SPEC.md](./FAQ_V3_PRODUCT_UX_SPEC.md) |
| Fase 1e | Implementada com diff, órfãos e migração idempotente |
| Fases 2–5 | Implementadas; checkpoints e piloto documentam as evidências |
| Privacidade Fases 3–4 | Padrões técnicos definidos em [PRIVACY_OPERATIONS](./FAQ_V3_PRIVACY_OPERATIONS.md) |

---

## 2. Fase 0 — Gate completo

*(Inalterado em substância — ver v4 seções 2.1–2.6.)*

### 2.1 Git e worktree

1. `git fetch origin`
2. `merge-base --is-ancestor 9752484d fc85440a` — bloqueante se falhar
3. Registrar SHAs; `rev-list --count` como evidência, não número fixo
4. Worktree `crm-faq-orientacoes-simplificacao`; branch `codex/faq-v3-phase0`
5. Commitar os quatro artefatos `FAQ_V3_*` como primeiro commit documental

### 2.2 Ambiente

| Item | Exigência |
|------|-----------|
| `VITE_ENABLE_MOCKS` | `false` homolog/prod |
| `VITE_SSO_DEV_BYPASS` | `true` homolog ou SSO real prod |
| FAQ Builder | Sem escrita `localStorage` institucional |

### 2.3 Seeds (três temas — não fundir)

| Seed | Tema |
|------|------|
| `faq-aluno-seed.json` | Acesso AVA |
| `faq-op-seed.json` | Matrícula |
| `faq-publico-seed.json` | Atendimento público |

### 2.4 Pass/fail

API três tipos; consumo aluno/OP/público; lineage ticket; BPO escalate; smoke PowerShell + Playwright + UI 2–5.

### 2.5 Restrições Fase 0

**Proibidos:** `Univesp Knowledge Bundle`, `Version`, `Theme Governance`, `Suggestion`, `Asset`.
**Permitido:** `Univesp Knowledge Library` (v2). Sem `schema_version: 3.0.0`.

### 2.6 Gate

Não iniciar 1a até verde.

---

## 3. Princípios arquiteturais

- Persistência por bundle/versão; biblioteca v2 read-only após cutover
- Grafo **árvore** (não DAG): um pai por nó; sem ciclos
- Identificadores estáveis em todo conteúdo editável
- Roteamento no servidor; cliente nunca envia fila final com lineage FAQ
- Governança: identidades distintas (seção 8)
- ETag: `"<version_id>-<revision>"`

---

## 4. Schema v3 — payload (`Univesp Knowledge Version.payload_json`)

### 4.1 Envelope do bundle

```json
{
  "schema_version": "3.0.0",
  "bundle_key": "acesso-ava",
  "theme_key": "acesso-ava",
  "metadata": {
    "title": "Acesso ao AVA",
    "audience_profile": "mixed",
    "operational_owner": { "owner_type": "queue", "owner_key": "atendimento-geral" },
    "criticidade_default_key": "media",
    "sla_policy_key": "48h"
  },
  "graph": {
    "student_root_node_id": "acesso-ava-root-student",
    "public_root_node_id": "acesso-ava-root-public",
    "internal_root_node_id": null
  },
  "routing_policy": {
    "pattern_key": "op_then_area",
    "bpo_enabled": false,
    "steps": ["op", "area"]
  },
  "nodes": [],
  "edges": [],
  "calendar_highlights": []
}
```

### 4.2 Grafo por público (MVP)

| Regra | Definição |
|-------|-----------|
| Topologia | **Árvore** — exatamente um `parent_node_id` por nó (via aresta entrante) |
| Raiz | `graph.{audience}_root_node_id` por público ativo (`student`, `public`, `internal`) |
| Visibilidade nó | `node.audiences: string[]` — ex.: `["student"]`, `["public","student"]` |
| Visibilidade aresta | `edge.audiences: string[]` — subconjunto dos públicos do nó pai |
| Camada null | Nó visível ao público mas `content.{audience}` null → nó **não navegável** para esse público (erro de validação na publicação) |
| Caminho sticky | Validado apenas no subgrafo do público da sessão |
| Ciclos | Proibidos |
| DAG | **Não suportado** no MVP |

#### Nó (`nodes[]`)

```json
{
  "node_id": "uuid-estavel",
  "stable_key": "acesso-ava-recuperar",
  "node_kind": "path|final",
  "audiences": ["student", "public"],
  "display": { "title": "...", "question": "..." },
  "content": {
    "student": { "blocks": [], "outcome_key": null },
    "public": { "blocks": [], "outcome_key": null }
  },
  "playbooks": {
    "op": { "...": "ver 4.4" },
    "bpo": null,
    "analyst": null
  },
  "operational": {
    "routing_key": null,
    "routing_override": null,
    "criticidade_key": null,
    "sla_policy_key": null
  },
  "document_policy": null
}
```

- `document_policy`: **somente** se `node_kind === "final"`; omitido em `path`

#### Aresta (`edges[]`)

```json
{
  "edge_id": "uuid",
  "parent_node_id": "...",
  "child_node_id": "...",
  "order": 1,
  "active": true,
  "audiences": ["student", "public"],
  "label": "Opção exibida"
}
```

### 4.3 Identificadores estáveis dentro do conteúdo

Todo item editável carrega ID imutável (sugestões e importação referenciam IDs, não índices):

| Elemento | Campo ID |
|----------|----------|
| Bloco de texto/mídia | `block_id` |
| Item de checklist | `checklist_item_id` |
| Ação permitida | `action_id` |
| Referência mídia | `media_ref_id` |
| Sistema consultado | `system_ref_id` |
| Documento a solicitar | `document_ref_id` |

Exemplo sugestão: `target_ref: { "type": "checklist_item", "id": "chk-001" }` — **não** `checklist[2]`.

### 4.4 Contrato de playbook

```json
{
  "objective": "string",
  "checklist": [
    { "checklist_item_id": "chk-001", "text": "Confirmar e-mail institucional", "required": true }
  ],
  "systems": [
    { "system_ref_id": "sys-001", "system_key": "portal-aluno", "label": "Portal do aluno" }
  ],
  "documents_to_request": [
    { "document_ref_id": "doc-001", "document_type_key": "rg", "label": "RG", "required": false }
  ],
  "suggested_reply": "string",
  "allowed_actions": [
    { "action_id": "act-001", "action_key": "reply_ticket", "label": "Responder" }
  ],
  "escalation": {
    "criteria": "string",
    "reason_template": "string",
    "routing_key": null
  },
  "outcomes": [
    { "outcome_key": "resolved", "label": "Resolvido", "next_node_id": null },
    { "outcome_key": "request_complement", "label": "Solicitar complemento", "next_node_id": null },
    { "outcome_key": "escalate", "label": "Encaminhar", "next_node_id": null },
    { "outcome_key": "return_to_student", "label": "Devolver ao aluno", "next_node_id": null },
    { "outcome_key": "open_ticket", "label": "Abrir atendimento", "next_node_id": null },
    { "outcome_key": "goto_node", "label": "Ir para nó", "next_node_id": "..." }
  ]
}
```

`action_key` catálogo: `reply_ticket`, `request_complement`, `escalate`, `transition_ticket`, `attach_ticket`, `open_ticket`, `goto_node`.

Herança BPO ← OP: por campo; `null` herda; `[]` vazio explícito; string vazia inválida.

### 4.5 Desfechos públicos (`content.*.outcome_key`)

Catálogo alinhado ao playbook, subset para aluno/público:

| `outcome_key` | Efeito |
|---------------|--------|
| `resolved` | Encerra jornada; telemetria `resolution_confirmed` |
| `open_ticket` | Abre intake/protocolo |
| `goto_node` | Navega para `next_node_id` |

### 4.6 Blocos de conteúdo (Fase 1)

```json
{ "block_id": "blk-001", "type": "text", "body": "..." }
{ "block_id": "blk-002", "type": "media_ref", "media_ref_id": "med-001" }
```

### 4.7 `document_policy` (somente `final`)

```json
{
  "mode": "disabled|optional|required",
  "allowed_document_types": ["rg", "comprovante"],
  "max_files": 2,
  "max_size_mb": 5
}
```

Limites **≤ máximos institucionais** (Runtime Settings). Editor não permite exceder teto global.

### 4.8 Validação de publicação (blockers)

- Grafo árvore válido por público; raízes definidas
- Nó visível com conteúdo null para público ativo
- Playbook OP efetivo quando `routing_policy` exige OP
- Órfãos, conflitos import, referências quebradas
- `document_policy` fora de `final`

---

## 5. DocTypes — campos e invariantes (Fase 1a)

### 5.1 `Univesp Knowledge Bundle`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `name` | autoname | Sim | `bundle_key` |
| `bundle_key` | Data | Sim | Unique index |
| `title` | Data | Sim | |
| `theme_key` | Link → Theme Governance | Sim | |
| `audience_profile` | Select | Sim | `student\|public\|mixed\|internal` |
| `status` | Select | Sim | `active\|archived` |
| `published_version` | Link → Version | Não | Versão vigente |
| `draft_version` | Link → Version | Não | **Único rascunho ativo** |
| `legacy_v2_bundle_id` | Data | Não | Migração |
| `created_by_email` | Data | Sim | |
| `created_at` | Datetime | Sim | |
| `archived_at` | Datetime | Não | |
| `archived_by_email` | Data | Não | |

**Invariantes:**

- Máximo **1** versão com `lifecycle_state in (draft, pending_approval)` por bundle (= rascunho ativo via `draft_version`)
- `published_version` aponta para versão `lifecycle_state=published`
- Bundle **nunca publicado** (`published_version` null): pode **excluir** permanentemente
- Bundle **já publicado**: somente **arquivar** (`status=archived`); exclusão proibida
- Versões: **nunca apagar** — retenção total
- Biblioteca: paginação server-side; filtros por `status`, `audience_profile`, `theme_key`, lifecycle do rascunho

### 5.2 `Univesp Knowledge Version`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `name` | autoname | Sim | = `version_id` imutável |
| `version_id` | Data | Sim | Unique; usado no ETag |
| `bundle` | Link → Bundle | Sim | Index |
| `version_label` | Data | Sim | Ex.: `2026-07-28-draft-01` |
| `revision` | Int | Sim | Default 1; incrementa a cada save draft |
| `lifecycle_state` | Select | Sim | Ver seção 8 |
| `payload_json` | Long Text | Sim | Max 2 MiB |
| `change_summary` | Text | Não | Obrigatório em `pending_approval` |
| `author_email` | Data | Sim | Imutável |
| `approver_email` | Data | Não | |
| `publisher_email` | Data | Não | |
| `approved_at` | Datetime | Não | |
| `published_at` | Datetime | Não | |
| `valid_from` | Datetime | Não | Vigência início |
| `valid_until` | Datetime | Não | Vigência fim |
| `timezone` | Data | Sim | Default institucional `America/Sao_Paulo` |
| `superseded_at` | Datetime | Não | |
| `rejection_reason` | Text | Não | |
| `import_source` | Select | Não | |
| `migration_idempotency_key` | Data | Não | Unique quando migração |

**Invariantes:**

- Payload imutável quando `lifecycle_state ∈ {approved, published, superseded, rejected}`
- ETag = `"<version_id>-<revision>"`
- Fork cria novo `version_id`, `revision=1`, `lifecycle_state=draft`

### 5.3 Publicação e vigência

| Regra | Comportamento |
|-------|---------------|
| Publicação | Admin publica versão `approved` |
| `valid_from` omitido | Vigência começa em `published_at` |
| `valid_from` futuro | Job ativa na data (timezone institucional) |
| `valid_until` | Job expira; novas sessões usam próxima versão publicada |
| Sticky | Sessões iniciadas mantêm `bundle_version_id` fixado |
| Vigente | Uma versão `published` ativa por bundle por instante (outras `superseded`) |
| UI | Sem campo “publicar imediatamente” — publicar = ação; vigência = `valid_from`/`valid_until` opcionais |

### 5.4 Arquivamento, exclusão, restauração

| Operação | Condição | Efeito |
|----------|----------|--------|
| Excluir bundle | Nunca teve `published_version` | Remove bundle + versões draft |
| Arquivar bundle | Já publicado | `status=archived`; oculto da biblioteca default; consumo existente via sticky |
| Restaurar versão | Target historicamente published | Rollback (seção 8.6) |
| Excluir versão | — | **Proibido** |
| Protocolos | Qualquer estado bundle | Lineage preservado |

### 5.5 `Univesp Knowledge Theme Governance`

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `theme_key` | Data, autoname | Sim |
| `theme_label` | Data | Sim |
| `owner_email` | Data | Sim | Responsável operacional do tema |
| `approver_group` | Link → Access Group | Sim |
| `editor_areas` | Table → Theme Editor Area | Sim |
| `suggestion_sla_hours` | Int | Não | Override; senão default Runtime Settings |
| `fallback_admin_group` | Link → Access Group | Não | **Somente alerta SLA** |

Child **`Univesp Knowledge Theme Editor Area`:** `area_key`, `area_label`, `can_edit_draft` (Check).

### 5.6 Migração idempotente

- `migration_idempotency_key` = `v2:{legacy_bundle_id}:{checksum}` — reexecução não duplica

---

## 6. Autorização (resumo)

Reutilizar `Univesp Access Group` + `Univesp Permission Assignment`. Escopo `knowledge_themes`.

Capacidades: `view_playbook_op|bpo|analyst`, `suggest_knowledge`, `edit_knowledge_draft`, `approve_knowledge`, `publish_knowledge_version`, `view_contact_details`, `view_sensitive_identity`, `view_routing_preview`.

OP/BPO: Permission Profiles distintos (`base_persona` em `common.py:310`).

Detalhe BPO/documentos: [FAQ_V3_PRIVACY_OPERATIONS.md](./FAQ_V3_PRIVACY_OPERATIONS.md).

---

## 7. Sticky session

- BFF cria `faq_session_id` opaco; estado em Redis
- Cookie `HttpOnly` = binding navegador (não session_id de negócio)
- Frontend envia `faq_session_id` via API
- Validação: caminho ordenado, contínuo, desde raiz do público, arestas ativas
- TTL: Runtime Settings `knowledge_session`
- `custom_source_path_json`: array ordenado de `node_id`

---

## 8. Lifecycle e identidades

Estados: `draft → pending_approval → approved → published → superseded`; `rejected` terminal.

Identidades fluxo normal:

- `approver_email ≠ author_email`
- `publisher_email ≠ author_email` **e** `publisher_email ≠ approver_email`

Break-glass: solicitante Admin + confirmador Admin distintos; ambos ≠ autor.

Rollback: target `superseded → published` na mesma transação.

`pending_approval → draft`: incrementa revision; limpa aprovação; registra quem pediu ajustes.

---

## 9. Roteamento — `routing_policy`

### 9.1 Padrões (`pattern_key`)

| `pattern_key` | Etapas | `bpo_enabled` |
|---------------|--------|---------------|
| `op_then_area` | OP → Área/Analista | false |
| `op_bpo_area` | OP → BPO → Área | true |
| `bpo_op_area` | BPO → OP → Área | true |
| `direct_area` | Área direto | false |
| `institutional_triage` | Triagem Central → equipe | false |

### 9.2 Schema

```json
{
  "pattern_key": "op_then_area",
  "bpo_enabled": false,
  "steps": ["op", "area"],
  "allowed_routing_keys": ["atendimento-geral", "sra"],
  "institutional_exceptions": ["provas", "critica"]
}
```

Override por nó: `operational.routing_override` (routing_key) — validada contra catálogo e pattern.

Editor **não** permite cadeias arbitrárias — só patterns do catálogo + overrides validados.

### 9.3 Resolução

Precedência: exceções institucionais → policy nó/bundle → polo/região → ownership → fallback.

Com lineage FAQ: ignorar `queue` cliente; inválido = erro.
Sem lineage: só `routing_key` catalogada + permissão; falha = erro.

Sem preview público. Preview autenticado: `POST /api/app/v1/routing/preview`.

---

## 10. Feature flags

Runtime Settings `knowledge_rollout` + infra por recurso (ver [FAQ_V3_PRIVACY_OPERATIONS.md](./FAQ_V3_PRIVACY_OPERATIONS.md)).

Endpoints: `GET /api/app/v1/runtime/flags`, `GET /api/public/v1/runtime/flags` (subconjunto seguro).

---

## 11. Importação — template planilha (Fase 1e)

### 11.1 Abas

| Aba | Conteúdo |
|-----|----------|
| `_meta` | `import_mode`, `export_base_version_id`, `export_base_revision`, `exported_at`, `bundle_key`, `field_hashes` JSON |
| `nodes` | Uma linha por nó |

### 11.2 Colunas `nodes`

| Coluna | Obrigatório |
|--------|-------------|
| `stable_key` | Sim |
| `parent_stable_key` | Sim (vazio = raiz do público indicado) |
| `audiences` | Sim (CSV: student,public) |
| `node_kind` | Sim |
| `title` | Sim |
| `content_student` | Não |
| `content_public` | Não |
| `playbook_op` | Não |
| `playbook_bpo` | Não |
| `playbook_analyst` | Não |
| `routing_key` | Não |
| `criticidade_key` | Não |
| `sla_policy_key` | Não |
| `document_mode` | Não (final only) |
| `outcome_key` | Não (final) |

Sem `_meta` export → fluxo **sem base** (duas vias).

---

## 12. Telemetria (resumo)

Eventos semânticos; abandono via job analítico (não expiração Redis); agregação por `faq_session_id`.

Detalhe e metas: [FAQ_V3_PRIVACY_OPERATIONS.md](./FAQ_V3_PRIVACY_OPERATIONS.md).

---

## 13. Fases técnicas e branches

| Fase | Branch | Dependências spec |
|------|--------|-------------------|
| 0 | `codex/faq-v3-phase0` | Seção 2 |
| 1a | `codex/faq-v3-1a` | Seções 4–5, 8 |
| 1b | `codex/faq-v3-1b` | Seções 4.2, 7 |
| 1c | `codex/faq-v3-1c` | Seção 9 |
| 1d | `codex/faq-v3-1d` | **PRODUCT_UX_SPEC** |
| 1e | `codex/faq-v3-1e` | Seção 11 |
| 2–5 | `codex/faq-v3-2` … | BACKLOG + PRIVACY |

Branches empilhadas; PR por fase com base explícita.

Fases 2–5: contratos resumidos em [FAQ_V3_BACKLOG.md](./FAQ_V3_BACKLOG.md).

---

## 14. Histórico

| Versão | Notas |
|--------|-------|
| v5 | Grafo por público, playbook completo, IDs estáveis, DocTypes completos, vigência, routing patterns; split 4 artefatos |
| v6 | Atualiza o estado pós-implementação e elimina gates externos já resolvidos tecnicamente |
