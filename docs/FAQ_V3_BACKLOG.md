# FAQ v3 — Backlog

Status: **v3** — execução contínua por fases, com checkpoint e rollback independentes.
Especificações: [EXEC](./FAQ_V3_EXECUTION_SPEC.md) | [UX](./FAQ_V3_PRODUCT_UX_SPEC.md) | [PRIVACY](./FAQ_V3_PRIVACY_OPERATIONS.md)

**Modelo de execução:** as fases são concluídas em sequência técnica, sem calendário artificial por sprint. Infraestrutura e integrações fazem parte da implementação.

---

## Fase 0 — funcionamento real atual

**Branch:** `codex/faq-v3-phase0`
**Gate:** Admin publica; três jornadas reais; sem mock/localStorage; público ignora fila cliente

| ID | História | Dep |
|----|----------|-----|
| S0-1 | Worktree + branch + commit docs v5 + PROGRAM | — |
| S0-2 | Publicar seeds aluno/op/público | S0-1 |
| S0-3 | Runtime aluno ← API bundle aluno | S0-2 |
| S0-4 | Runtime OP/BPO ← API bundle op | S0-2 |
| S0-5 | `/publico` ← API bundle publico | S0-2 |
| S0-6 | Remover localStorage FAQ institucional | S0-1 |
| S0-7 | Lineage completo em protocolos | S0-3,4,5 |
| S0-8 | `public.create` ignora queue cliente | S0-5 |
| S0-9 | Smoke PS + Playwright + manual 2–5 | S0-7,8 |
| S0-10 | Baseline métricas + indisponíveis registradas | S0-9 |

---

## Fase 1a — persistência e lifecycle

**Branch:** `codex/faq-v3-phase1a`

| ID | História | Dep |
|----|----------|-----|
| S1-1 | DocTypes Bundle, Version, Theme Governance, Editor Area | S0 |
| S1-2 | Runtime Settings flags/sessões/SLAs | S1-1 |
| S1-3 | API upsert + ETag version_id-revision + 409 | S1-1 |
| S1-4 | Lifecycle + identidades + break-glass | S1-3 |
| S1-5 | 1 rascunho ativo; arquivar/excluir | S1-1 |
| S1-6 | Paginação biblioteca | S1-3 |
| S1-7 | Rollback conteúdo transacional | S1-4 |
| S1-8 | v2 read-only no cutover (flag) | S1-3 |

---

## Fase 1b — runtime, sticky version e telemetria

**Branch:** `codex/faq-v3-phase1b`

| ID | História | Dep |
|----|----------|-----|
| S2-1 | Grafo árvore por público + validação | S1 |
| S2-2 | Redis session + cookie binding | S1 |
| S2-3 | Sticky path validation | S2-1,2 |
| S2-4 | Leitor v2/v3 | S2-3 |
| S2-5 | Telemetria + adapter dashboard | S2-4 |
| S2-6 | custom_source_path_json | S2-3 |

---

## Fase 1c — roteamento canônico

**Branch:** `codex/faq-v3-phase1c`

| ID | História | Dep |
|----|----------|-----|
| S3-1 | Catálogo routing patterns | S2 |
| S3-2 | Motor resolução server | S3-1 |
| S3-3 | tickets.create knowledge-only routing | S3-2 |
| S3-4 | Manual routing_key + erro se inválido | S3-2 |
| S3-5 | Preview autenticado + testes paridade | S3-3 |

---

## Fase 1d.1 — biblioteca

**Branch:** `codex/faq-v3-phase1d-library`

| ID | História | Dep |
|----|----------|-----|
| S4-1 | Biblioteca colunas/filtros PT | S3, UX |
| S4-2 | Ações abrir/duplicar/arquivar/restaurar/excluir | S4-1 |
| S4-3 | Remoções limpeza UX §5 | S4-1 |
| S4-4 | Vigência na biblioteca | S4-1 |

---

## Fase 1d.2 — editor

**Branch:** `codex/faq-v3-phase1d-editor`

| ID | História | Dep |
|----|----------|-----|
| S5-1 | Árvore + abas camadas | S4 |
| S5-2 | Playbooks + herança BPO | S5-1 |
| S5-3 | Prévia da jornada por persona | S5-1 |
| S5-4 | Microcopy publicação/aprovação | S5-1 |
| S5-5 | Teste usabilidade 4 perfis | S5-3 |
| S5-6 | Painel orientação operacional | S5-2 |

---

## Fase 1e — importação e migração

**Branch:** `codex/faq-v3-phase1e`

| ID | História | Dep |
|----|----------|-----|
| S6-1 | Template XLSX + _meta | S5 |
| S6-2 | Import 3 vias / 2 vias | S6-1 |
| S6-3 | Migração v2→v3 idempotente + relatório | S6-1 |
| S6-4 | Piloto acesso-ava publicado v3 | S6-3 |

---

## Fase 2.1 — colaboração no backend

**Branch:** `codex/faq-v3-phase2-backend`

| ID | História | Dep |
|----|----------|-----|
| S7-1 | DocType Suggestion + target_ref | S6 |
| S7-2 | Permission Assignment grants | S7-1 |
| S7-3 | Conversão sugestão → rascunho | S7-1 |
| S7-4 | SLA alertas fallback_admin | S7-3 |
| S7-5 | Testes negativos escopo | S7-2 |

---

## Fase 2.2 — colaboração na interface

**Branch:** `codex/faq-v3-phase2-ui`

| ID | História | Dep |
|----|----------|-----|
| S8-1 | Botão sugerir no nó | S7 |
| S8-2 | Fila sugestões Gestor | S7 |
| S8-3 | Fluxo aprovação UI | S7 |
| S8-4 | Notificação autor sugestão | S7 |

---

## Fase 3.1 — atendimento público

**Branch:** `codex/faq-v3-phase3-public`

| ID | História | Dep |
|----|----------|-----|
| S9-1 | FAQ anônima + flags públicas | S8 |
| S9-2 | Formulário abertura + vínculos | S9-1 |
| S9-3 | CPF condicional (intake_policy) | S9-2 |
| S9-4 | Rate limit + mensagens genéricas | S9-1 |

---

## Fase 3.2 — documentos

**Branch:** `codex/faq-v3-phase3-documents`

| ID | História | Dep |
|----|----------|-----|
| S10-1 | intake_session + quarentena | S9, TI |
| S10-2 | document_policy backend | S10-1 |
| S10-3 | CPF encrypt + mascaramento | S10-1 |
| S10-4 | Matriz acesso + auditoria download | S10-2 |
| S10-5 | Retenção jobs | PRIVACY OK |
| S10-6 | Gate produção documentos | S10-5 |

---

## Fase 4.1 — identidade

**Branch:** `codex/faq-v3-phase4-identity`

| ID | História | Dep |
|----|----------|-----|
| S11-1 | Catálogo polo/curso | S10 |
| S11-2 | Cruzamento genérico | S11-1, Directory |
| S11-3 | Fila humana + painel | S11-2 |
| S11-4 | Estado identidade no contexto | S11-2 |

---

## Fase 4.2 — e-mail

**Branch:** `codex/faq-v3-phase4-email`

| ID | História | Dep |
|----|----------|-----|
| S12-1 | Verificação e-mail código | S11 |
| S12-2 | Thread channel_adapter | S12-1, ingress |
| S12-3 | Antispoof + auditoria | S12-2 |

---

## Fase 5 — mídia e acessibilidade

**Branch:** `codex/faq-v3-phase5-media`

| ID | História | Dep |
|----|----------|-----|
| S13-1 | Knowledge Asset + upload | S12 |
| S13-2 | Blocos ricos + allowlist | S13-1 |
| S13-3 | Acessibilidade mídia | S13-2 |

---

## Validação integrada e piloto

**Branch:** `codex/faq-v3-pilot`

| ID | História | Dep |
|----|----------|-----|
| S14-1 | Integração end-to-end homolog 5d | S13 |
| S14-2 | Checklist expansão PROGRAM §13 | S14-1 |
| S14-3 | Piloto prod 10d acesso-ava | S14-2 |
| S14-4 | Runbooks rollback 4 níveis validados | S14-1 |

---

## Integrações incluídas na execução

| Integração | Entrega |
|------------|---------|
| Controles LGPD | Inventário, minimização, criptografia, retenção, auditoria e dossiê técnico |
| GCS + antimalware | Bucket privado, quarentena, scanner e descarte |
| Student Directory | Projeção institucional, sincronização e validação |
| E-mail | Envio, recebimento, correlação e proteção contra fraude |
| IdP SSO | Compatibilidade preservada; problemas de login atendidos pelo fluxo sem SSO |

---

## Histórico

| Versão | Notas |
|--------|-------|
| v1 | Épicos E0–E5 |
| v2 | 15 sprints + branches PROGRAM |
| v3 | Execução contínua por fases; infraestrutura e integrações incorporadas |
