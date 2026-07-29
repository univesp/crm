# FAQ v3 — checkpoint da Fase 1b

Data: 2026-07-28
Branch: `codex/faq-v3-phase1b`

## Implementado

- leitura compatível de bundles publicados v2 e v3;
- projeção do mesmo grafo para Aluno, Público, OP, BPO e Analista;
- árvores independentes por público, com validação de raiz, ciclos, pais,
  arestas, alcance e caminho contínuo;
- herança BPO a partir do OP por campo, preservando arrays vazios como
  sobrescrita explícita;
- sticky version no backend para jornadas autenticadas;
- identificador de navegador em cookie `HttpOnly`, sem conteúdo da FAQ ou PII;
- registro de sessão no Redis com TTL institucional e vínculo opaco ao ator;
- continuidade da jornada na versão original depois de nova publicação;
- validação server-side do lineage informado ao abrir protocolo;
- persistência de bundle, versão, nó, caminho, público e sessão no protocolo;
- eventos canônicos idempotentes da jornada e DocType imutável de telemetria;
- descarte diário da telemetria bruta após 90 dias por padrão, preservando
  somente agregações não identificáveis;
- adapter temporário para as métricas legadas do painel Admin;
- flags autenticadas e subconjunto público sanitizado;
- frontend institucional sem geração local de sessões ou lineage v3;
- consumo dinâmico do playbook operacional publicado.

## Testes executados

| Validação | Resultado |
|---|---|
| Ruff de todo o app Frappe | passou |
| Testes puros do grafo e herança BPO | 4 passaram |
| ESLint dos arquivos alterados | passou |
| Typecheck do frontend | passou |
| Build de produção do frontend | passou |
| Playwright FAQ/Admin/aluno/OP/público/sticky | 7 passaram |
| Suíte Node do gateway | 17 passaram |
| `git diff --check` | passou |
| Integração Frappe de sticky version e idempotência | criada |

O teste transacional Frappe requer `bench migrate` e `bench run-tests` no
ambiente Frappe. A worktree isolada não possui um bench executável, portanto
essa evidência continuará no gate de homolog, sem substituir persistência por
mock.

## Evidências

- `e2e/faq-sticky-version.spec.js` confirma versão fixa e caminho ordenado;
- `tests/test_knowledge_graph.py` cobre árvores por público, ciclo, múltiplos
  pais, caminho e herança BPO;
- `tests/test_knowledge_runtime.py` cobre sessão fixada, nova publicação,
  idempotência e lineage do protocolo;
- o frontend só envia `faq_session_id`; o backend deriva e valida o restante do
  lineage v3.

## Riscos conhecidos

1. Redis indisponível interrompe jornadas v3 em vez de degradar para lineage
   não confiável; esse comportamento é intencional e precisa de monitoramento.
2. Migração dos DocTypes e o teste transacional dependem do ambiente bench.
3. As flags v3 permanecem desligadas até implantação e validação em homolog.
4. Sticky version pública será habilitada apenas na Fase 3.

## Teste do usuário

Não precisa testar. Esta fase é técnica e foi validada automaticamente.

O gate operacional antes de ligar a leitura v3 é:

1. executar `bench migrate`;
2. rodar `bench run-tests --app univesp_atendimento`;
3. publicar duas versões do piloto em homolog;
4. iniciar jornada na primeira e confirmar continuidade após a segunda;
5. conferir lineage e eventos no protocolo;
6. ativar `knowledge_v3_read` somente depois dessas verificações.
