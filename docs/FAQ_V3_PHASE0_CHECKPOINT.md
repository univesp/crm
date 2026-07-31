# FAQ v3 — checkpoint da Fase 0

Data: 2026-07-28
Branch: `codex/faq-v3-phase0`

## Estado

Implementação local concluída. A ativação em homolog permanece pendente até o
merge e o deploy autorizados. O bootstrap de homolog agora exporta a biblioteca
v2 para arquivo privado, publica os três seeds, publica o piloto v3, cria os
perfis sintéticos e habilita as flags de forma idempotente e auditável.

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
| Playwright FAQ/piloto focado | 18 testes passaram |
| Playwright completo | 29 testes passaram |
| Contratos canônicos | 68 testes passaram |
| Gateway | 18 testes passaram |
| Contratos Cloud Run | 33 testes passaram |
| Ruff dos arquivos Python alterados | passou |
| Backend Frappe local | não executado: ambiente Python local não possui `frappe` |

## Riscos e pendências

1. O gate remoto da Fase 0 exige executar o workflow manual de homolog. O job de
   bootstrap e o smoke falham se seeds, versão v3, filas ou flags não existirem.
2. A auditoria de dependências encontrou vulnerabilidades transitivas de severidade
   alta em dependências do `exceljs`. Não foi aplicado downgrade forçado; o risco
   será tratado na Fase 1e e no hardening.
3. A branch ainda não foi implantada em homolog. Não há evidência remota do código
   novo até o workflow concluir e publicar seu pacote de evidências.

## Teste do usuário

Não precisa testar neste checkpoint local.

Após a implantação em homolog, o teste do usuário continuará opcional. A validação
autenticada será feita com os perfis de smoke e anexada a este checkpoint.
