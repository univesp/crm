# Roteiro de Implementação UX — CRM UNIVESP

Status: **ativo** — guia operacional para agentes e Codex.
Atualizado: 2026-08-05.

Documentos relacionados:

- [UX_PRINCIPLES_CRM.md](./UX_PRINCIPLES_CRM.md)
- [AI_WORKFLOW.md](./AI_WORKFLOW.md)
- [VALIDATION_PLAYBOOK.md](./VALIDATION_PLAYBOOK.md)
- [FAQ_V3_PRODUCT_UX_SPEC.md](./FAQ_V3_PRODUCT_UX_SPEC.md)

---

## 1. Linhas de trabalho paralelas

```text
Linha A — Dados e infraestrutura
SEI, banco acadêmico, Redis, SSO, importadores, homologação
Branch exemplo: codex/sei-daily-sync (não misturar com UX)

Linha B — Produto e UX
Telas, textos, botões, estados, hierarquia, sinais e navegação
Branches exemplo: codex/ux-01-copy-status, codex/ux-02-aluno, …
```

**Regra da Linha B:** não criar tabelas, módulos ou contratos novos. Consumir contratos existentes.

---

## 2. Premissa de público — aluno ativo primeiro

### Escopo imediato (MVP UX)

- Atender **aluno autenticado com vínculo vigente** (ativo / trancado — códigos SEI a confirmar).
- Foco em autosserviço, FAQ publicada, protocolo e acompanhamento.

### Ex-aluno — decisão adiada

Segmentação de FAQ por situação acadêmica (ativo vs ex-aluno) **não deve ser implementada agora**.

Aguardar confirmação de:

- regras de SSO (quem autentica, com qual claim/perfil);
- lógica de sistema (Directory, `situacao`, elegibilidade pós-login);
- política institucional de atendimento a ex-aluno.

### Hipótese provisória (não implementar ainda)

Enquanto a decisão não fechar, a premissa de produto é:

```text
Aluno ativo/trancado  → jornada autenticada (/aluno) + FAQ student
Ex-aluno / sem acesso → pode entrar como público externo (/publico)
                        com FAQ public mais simples, até decisão final
```

Isso **não autoriza** hoje:

- novo `faq_type`;
- novas audiences no grafo V3;
- filtro por `situacao` no runtime;
- bloqueio de login por situação acadêmica.

Quando SSO e regra de negócio forem confirmados, avaliar spec dedicada (`docs/FAQ_ELIGIBILITY_SITUACAO.md` — a criar).

### Público externo — adiado

Implementação de visitante real (`/publico`) fica **depois** da jornada autenticada e do FAQ Builder editorial.
Decisão pendente: como o visitante acompanha protocolo (portal, código ou e-mail).

---

## 3. Fases de UX (ordem de execução)

| Fase | Escopo | Branch sugerida | Risco |
|------|--------|-----------------|-------|
| **0** | Proteção — não alterar produto na branch SEI/sync | — | — |
| **1** | Copy, acentuação, estados vazios/erro/carregamento, contraste, uma ação primária por tela | `codex/ux-01-copy-status` | Baixo — **merged** ([PR #43](https://github.com/univesp/crm/pull/43)) |
| **2** | Perfil aluno autenticado (`/aluno/*`) | `codex/ux-02-aluno` | Baixo–médio — **merged** ([PR #44](https://github.com/univesp/crm/pull/44), [PR #45](https://github.com/univesp/crm/pull/45)) |
| **7** | FAQ Builder (`/admin/faq`, editor V3) — em paralelo após Fase 1 | `codex/ux-05-admin-faq` | Médio — **1ª entrega merged** ([PR #46](https://github.com/univesp/crm/pull/46)) |
| **4** | OP/secretário (`/op/*`) | `codex/ux-03-operacao` | Médio — **1ª entrega merged** ([PR #47](https://github.com/univesp/crm/pull/47)); pendente `/op/playbook`, `/op/novo-atendimento` |
| **5** | Gestores, área, BPO | `codex/area-manager-progressive-ux` | Médio — **1ª entrega merged** ([PR #48](https://github.com/univesp/crm/pull/48)); governança/distribuição + copy gestor |
| **6** | Admin central | `codex/ux-06-admin-central` | Médio — **1ª entrega merged** ([PR #49](https://github.com/univesp/crm/pull/49)); pendente auditoria, parâmetros, permissões |
| **3** | Público externo | `codex/ux-06-homologacao-integrada` | Alto — por último |

### Fase 1 — arquivos prioritários

- `univesp-frontend/src/App.vue`
- `univesp-frontend/src/data/navigation.js`
- `univesp-frontend/src/components/StatusBadge.vue`
- runtimes de copy: `studentPortalRuntime.js`, layouts compartilhados
- padrões de loading / vazio / erro / sucesso / sem permissão

### Fase 2 — telas aluno

| Rota | Arquivo |
|------|---------|
| `/aluno` | `StudentHomePage.vue` |
| `/aluno/duvida` | `StudentJourneyPage.vue` |
| `/aluno/protocolo` | `StudentProtocolPage.vue` |
| `/aluno/confirmacao/:protocolId` | `StudentConfirmationPage.vue` |
| `/aluno/solicitacoes` | `StudentRequestsPage.vue` |
| `/aluno/solicitacoes/:protocolId` | `StudentRequestDetailPage.vue` |

**Critério de aceite (duvida):** o aluno responde sozinho: *O que foi respondido? Isso resolve? Se não, o que acontece?*

**Status visíveis ao aluno (padronizar copy, não renomear códigos internos):**

```text
Precisa da sua ação
Aguardando atendimento
Em análise
Respondida no portal
Concluída
```

---

## 4. Instruções para Codex / agentes

### Pode pedir implementação?

**Sim.** Use prompts por fase, uma branch por grupo de telas, escopo explícito.

Exemplo de prompt (Fase 2 — branch `codex/ux-02-aluno`):

```text
Implemente a Fase 2 de docs/UX_IMPLEMENTATION_ROADMAP.md na branch codex/ux-02-aluno.

Telas: StudentHomePage, StudentJourneyPage, StudentProtocolPage,
StudentConfirmationPage, StudentRequestsPage, StudentRequestDetailPage.

Objetivo: uma ação primária por tela; copy orientado à ação; status visíveis
padronizados (copy only). Critério: aluno responde sozinho o que foi respondido,
se resolve e o que acontece se continuar.

Fora de escopo: ex-aluno, situacao acadêmica, público externo, router, auth,
SSO, APIs, FAQ V3 schema. Siga safe-vue-patch e crm-ux-review.
Validar lint, typecheck, E2E student-published-faq, foundation.
```

Exemplo de prompt (Fase 1 — concluída):

```text
Implemente a Fase 1 do docs/UX_IMPLEMENTATION_ROADMAP.md na branch codex/ux-01-copy-status.
Escopo: acentuação e padronização de estados vazios/erro/carregamento em App.vue,
StatusBadge e studentPortalRuntime.js. Não alterar router, auth, APIs ou FAQ V3 schema.
Validar lint e typecheck do frontend.
```

### Leitura obrigatória antes de codar

1. `AGENTS.md`
2. `docs/UX_IMPLEMENTATION_ROADMAP.md` (este arquivo)
3. `docs/UX_PRINCIPLES_CRM.md`
4. `docs/AI_WORKFLOW.md`
5. `docs/VALIDATION_PLAYBOOK.md`
6. Skill `safe-vue-patch` (patches Vue)
7. Skill `crm-ux-review` (revisão de jornada)
8. Skill `admin-ux-simplification` (somente Admin/FAQ Builder)

### Regras não negociáveis

- **Um patch = uma preocupação principal.**
- **Diff pequeno** — preferir 1–5 arquivos por PR.
- **Não misturar** refactor amplo com ajuste visual.
- **Não trabalhar** na branch `codex/sei-daily-sync` para UX.
- **Não alterar** sem aprovação explícita:
  - `router.js`, guards, rotas
  - SSO, auth, sessão, permissões
  - contratos API / serviços centrais (`appApi.js` salvo copy de mensagem)
  - DocTypes Frappe, schema FAQ V3, build/deploy
- **Não renomear** chaves internas de status, IDs de FAQ, nomes de rota ou contratos.
- **Não implementar** segmentação ex-aluno, filtro por `situacao` ou público externo real neste ciclo.

### O que fazer em cada entrega

1. Criar branch a partir de `origin/univesp/cloudrun-homolog` (ou base acordada).
2. Mapear arquivos exatos antes de editar.
3. Reutilizar componentes e padrões existentes.
4. Alinhar copy em **página + runtime** (evitar acentuação só na UI).
5. Garantir **uma ação primária** por tela.
6. Mensagens orientadas à ação (não técnicas).
7. Validar proporcional ao risco (Nível 2 do playbook).
8. Entregar evidências: `git diff --stat`, `git status --short`, comandos rodados.

### Validação mínima (mudança funcional frontend)

```powershell
cd univesp-frontend
npm run lint
npm run typecheck
# Se tocou jornada aluno:
npm run test:e2e -- e2e/student-published-faq.spec.js
```

Validação visual manual ou screenshot quando houver mudança de layout.

### Formato de reporte ao concluir

- **Escopo entregue** (fase, arquivos, telas)
- **Decisões tomadas** (copy, hierarquia)
- **Fora de escopo** (o que não foi feito de propósito)
- **Risco residual**
- **Evidências** (diff, status, comandos)

---

## 5. Anti-padrões

- Múltiplas ações primárias na mesma tela
- Erro sem caminho de recuperação
- Expor status internos de fila/área ao aluno
- Modal com excesso de campos (Admin/FAQ)
- Alterar contrato “de passagem” durante patch de copy
- Implementar ex-aluno ou público antes da decisão de SSO

---

## 6. Critério de pronto por fase

- [ ] Branch separada da Linha A (SEI/sync)
- [ ] Diff pequeno e revisável
- [ ] Sem mudança de contrato não solicitada
- [ ] Lint + typecheck verdes
- [ ] E2E do perfil afetado (quando aplicável)
- [ ] Screenshot ou validação visual registrada
- [ ] `git diff --check` limpo
- [ ] Reporte com risco residual
