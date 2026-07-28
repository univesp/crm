# FAQ v3 — checkpoint da Fase 1c

Data: 2026-07-28
Branch: `codex/faq-v3-phase1c`

## Implementado

- motor canônico de roteamento executado no servidor;
- precedência fixa: exceção institucional, política do nó/bundle,
  polo/região, responsável operacional e fallback;
- padrões OP, BPO, área e triagem lidos do catálogo institucional;
- filas ativas incorporadas idempotentemente às chaves permitidas;
- preview autenticado restrito pela capacidade `view_routing_preview`;
- criação de protocolo autenticada, pública e omnichannel usando o mesmo
  resolvedor quando `routing_server_authority` está ativa;
- fila enviada pelo cliente ignorada em jornadas FAQ;
- rota manual aceita somente por `routing_key` catalogada e perfil autorizado;
- lineage inválido, rota fora do catálogo ou fila inativa falham sem fallback
  silencioso;
- validação de owner, override, fallback e fila ativa antes da publicação;
- decisão e regras aplicadas persistidas no contexto do protocolo;
- resposta pública permanece sem chave ou nome de fila interna;
- leitura v2 preservada, mas a fila é relida do bundle publicado no servidor.

## Casos de referência

| Contexto | Destino esperado | Regra |
|---|---|---|
| Tema `provas` | `sra` | exceção institucional |
| Criticidade `critica` | `sra` | exceção institucional |
| Override válido no nó | fila do override | política do nó |
| Padrão iniciado por OP + polo com fila ativa | fila OP do polo | polo/região |
| Sem instância específica + owner de fila | fila do owner | ownership |
| Sem regra específica | `atendimento-geral` | fallback institucional |
| Lineage ou fila inválida | erro 422 | falha fechada |

## Testes executados

| Validação | Resultado |
|---|---|
| Ruff de todo o app Frappe | passou |
| Grafo + precedência + falha fechada + sanitização pública | 9 passaram |
| Suíte Node do gateway | 17 passaram |
| Proteção anônima do preview | passou |
| ESLint do cliente de preview | passou |
| Playwright aluno/OP/BPO/público/sticky/wiring | 6 passaram |
| `git diff --check` | passou |
| Paridade preview versus criação no Frappe | teste de integração criado |

O teste transacional do Frappe continua dependente de `bench migrate` e
`bench run-tests`. A paridade não foi implementada por duplicação: preview e
criação chamam o mesmo resolvedor.

## Riscos conhecidos

1. A resolução por polo/região exige que as filas correspondentes existam e
   estejam ativas no catálogo; caso contrário, segue para owner/fallback.
2. A ativação da flag depende da implantação no site homolog.
3. Rotas históricas v2 inválidas passam a falhar quando a autoridade do
   servidor for ligada; devem aparecer no relatório de migração da Fase 1e.

## Teste do usuário

Opcional. Não bloqueia a próxima fase.

Se quiser conferir operacionalmente em homolog:

1. simular um fluxo normal de acesso ao AVA;
2. simular um caso de `provas`;
3. comparar o preview interno com a fila do protocolo;
4. tentar enviar outra fila pelo navegador e confirmar que ela é ignorada.
