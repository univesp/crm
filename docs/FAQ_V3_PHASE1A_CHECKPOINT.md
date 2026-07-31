# FAQ v3 — checkpoint da Fase 1a

Data: 2026-07-28
Branch: `codex/faq-v3-phase1a`

## Implementado

- DocTypes `Univesp Knowledge Bundle`, `Univesp Knowledge Version`,
  `Univesp Knowledge Theme Governance`, áreas editoras e catálogo de padrões;
- Runtime Settings ampliado com flags v3, TTL, fuso e SLA de sugestões;
- API v3 paginada para catálogo, bundles, rascunhos e histórico;
- ETag `"<version_id>-<revision>"`, `If-Match` e conflito HTTP 409;
- lifecycle único com transições protegidas pela API;
- um rascunho ativo por bundle;
- conteúdo, identidades e metadados históricos imutáveis após aprovação;
- segregação autor, aprovador e publicador;
- break-glass com solicitação, segundo Admin, expiração e auditoria;
- publicação imediata ou agendada e expiração por scheduler;
- rollback transacional para versão historicamente publicada;
- arquivamento, restauração e exclusão restrita a rascunho sem histórico;
- feature flag de escrita com fallback de leitura v2;
- escopo `knowledge_themes` preservado no modelo de autorização;
- rotas BFF autenticadas, com ETag preservado na resposta;
- seeds idempotentes dos cinco padrões institucionais de roteamento.

## Testes executados

| Validação | Resultado |
|---|---|
| Ruff de todo o app Frappe | passou |
| Parse AST de todo o app Frappe | passou |
| Parse JSON dos DocTypes v3 | passou |
| Suíte Node do gateway | 17 testes passaram |
| Proteção anônima das rotas v3 | passou |
| Teste de integração Frappe de CRUD/lifecycle/rollback/break-glass | criado |

O teste de integração Frappe não roda no Python isolado desta worktree porque o
runtime local não possui `frappe`. Ele deve ser executado por `bench run-tests` no
ambiente Frappe após `bench migrate`. Essa limitação não foi ocultada nem substituída
por mock de persistência.

## Riscos conhecidos

1. Migração de schema e teste transacional real dependem do ambiente bench.
2. As flags permanecem desligadas por padrão; v2 continua gravável até
   `knowledge_v3_write` ser ativada.
3. A ativação em homolog ainda depende de sessão e implantação autenticadas.

## Teste do usuário

Não precisa testar. Esta fase é técnica.

O gate operacional antes de ligar a flag é:

1. executar `bench migrate`;
2. rodar `bench run-tests --app univesp_atendimento`;
3. confirmar os cinco padrões seedados;
4. ativar escrita v3 somente em homolog;
5. repetir CRUD, conflito 409, publicação, rollback e break-glass.
