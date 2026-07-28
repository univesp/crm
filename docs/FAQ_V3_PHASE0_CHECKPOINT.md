# FAQ v3 — checkpoint da Fase 0

Data: 2026-07-28
Branch: `codex/faq-v3-phase0`

## Estado

Implementação local concluída. A ativação em homolog permanece pendente porque a
sessão disponível não está autenticada como Admin central. Esse limite impede, de
forma legítima, exportar a biblioteca administrativa atual, publicar os três seeds
e produzir evidência autenticada das jornadas em homolog.

O código não usa credenciais embutidas e não contorna SSO.

## Implementado

- quatro especificações v5 versionadas;
- FAQ Builder institucional conectado à API, sem persistência em `localStorage`;
- carregamento institucional explícito para aluno, OP/BPO e público;
- runtimes OP/BPO separados do runtime do aluno;
- ausência de fallback silencioso para conteúdo mock em modo institucional;
- lineage com bundle, versão e nó na abertura de protocolo;
- criação de protocolo do aluno corrigida para usar o BFF;
- fila enviada pelo navegador ignorada no endpoint público;
- validação server-side de bundle, versão e nó públicos;
- lineage propagado pelo ingresso omnichannel;
- cobertura Playwright para biblioteca, aluno, OP e público;
- testes unitários de backend adicionados para lineage e mass assignment.

## Testes e evidências

| Validação | Resultado |
|---|---|
| `npm run typecheck` | passou |
| ESLint dos arquivos alterados | passou |
| `npm run build` | passou; apenas aviso de chunks acima de 500 kB |
| Playwright FAQ focado | 4 testes passaram |
| Playwright `mvp-wiring.spec.js` | 2 testes passaram |
| Ruff dos arquivos Python alterados | passou |
| Smoke público de homolog | saúde e FAQ pública responderam |
| Backend Frappe local | não executado: ambiente Python local não possui `frappe` |

## Riscos e pendências

1. O gate remoto da Fase 0 exige uma sessão Admin central em homolog para:
   exportar a biblioteca v2, publicar os três seeds e executar o smoke autenticado.
2. A auditoria de dependências encontrou vulnerabilidades transitivas de severidade
   alta em dependências do `exceljs`. Não foi aplicado downgrade forçado; o risco
   será tratado na Fase 1e e no hardening.
3. A branch ainda não foi implantada em homolog. Portanto, os resultados remotos
   observados são baseline, não evidência do código novo.

## Teste do usuário

Não precisa testar neste checkpoint local.

Após a implantação em homolog, o teste do usuário continuará opcional. A validação
autenticada será feita com os perfis de smoke e anexada a este checkpoint.
