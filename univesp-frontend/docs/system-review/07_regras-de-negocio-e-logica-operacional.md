# Regras de negocio e logica operacional

## Como interpretar este documento

Cada regra foi classificada em:

- **Regra confirmada no codigo**: implementacao explicita encontrada.
- **Regra inferida pela interface**: comportamento sugerido na UX, sem validacao completa na camada de dominio.
- **Hipotese nao comprovada**: plausivel, mas depende de backend/contrato final.

---

## 1) Regras de fila e priorizacao

## Regra confirmada no codigo

1. Fila OP e fila Area aplicam filtros por escopo/perfil e status.
2. Buckets de fila usam mapeamentos de status canonicos e labels operacionais.
3. Visualizacao de casos respeita `allowedProfiles` + `requiredActions` por rota.
4. Casos da area podem ser agrupados por ownership (`mine`, `unassigned`, `waiting_complement`, `completed`).

**Evidencia:** `src/services/operatorQueueRuntime.js`, `src/services/areaQueueRuntime.js`, `src/router.js`.

## Regra inferida pela interface

1. Usuario deve priorizar casos vencidos/em risco primeiro.
2. Gestor usa leitura por bucket para redistribuicao.

## Hipotese nao comprovada

1. Formula final de prioridade global em backend ainda nao esta fechada.

---

## 2) Criticidade e SLA

## Regra confirmada no codigo

1. Ha niveis de SLA e criticidade com chaves e badges configuraveis.
2. Regras podem ser aplicadas por tema/subtema/fila.
3. Dashboard admin projeta impacto dessas regras em casos ativos.
4. Runtime classifica SLA em `on_track`, `at_risk`, `overdue`, `closed`.

**Evidencia:** `src/pages/admin/AdminParametersPage.vue`, `src/services/adminParametersRuntime.js`, `src/services/canonicalCaseRuntime.js`.

## Regra inferida

1. Criticidade alta deve influenciar priorizacao da fila operacional.

## Hipotese nao comprovada

1. Politica oficial institucional de override entre regra de tema e regra de fila.

---

## 3) Escalonamento e roteamento

## Regra confirmada no codigo

1. Existe roteamento padrao por fila/area com possibilidade de excecao gerencial.
2. Acoes OP podem gerar escalonamento para area.
3. Area pode encaminhar excepcionalmente com motivo estruturado.
4. Routing decisions sao registradas com modo (`default`/`manager_exception`) e justificativa.

**Evidencia:** `src/services/caseRoutingRuntime.js`, `src/stores/studentSupport.js`, `src/pages/area/AreaCaseDetailPage.vue`.

## Regra inferida

1. Escalonamento deve ser excecao quando camada atual consegue resolver.

## Hipotese nao comprovada

1. Matriz final de excecoes aprovadas por politica institucional.

---

## 4) Conhecimento (FAQ/orientacao/playbook)

## Regra confirmada no codigo

1. Estrutura canonica contempla subject/subsubject/node e links.
2. Bundle de conhecimento possui workflow de versao.
3. Publicacao define versao ativa.
4. Sugestoes seguem workflow de revisao/aprovacao/rejeicao.
5. Uso de conhecimento por caso gera registro (knowledge usage).

**Evidencia:** `src/services/canonicalFoundationRuntime.js`, `src/pages/admin/AdminVersioningPage.vue`, `src/pages/area/AreaKnowledgeReviewPage.vue`.

## Regra inferida

1. Conteudo vigente orienta decisao operacional em OP e Area.

## Hipotese nao comprovada

1. Estrategia final de importacao em massa (planilha) com validacao semantica.

---

## 5) Assignment e distribuicao

## Regra confirmada no codigo

1. Distribuicao filtra por:
area, assunto/subassunto, elegibilidade ativa, disponibilidade, capacidade e carga.
2. Assignments concluídos nao contam para carga ativa.
3. Indisponibilidade pode ser global ou por area e respeita janela temporal.
4. Regra de elegibilidade com `isActive=false` e ignorada.
5. Caso pode ficar sem responsavel (`unassigned_exception`) se nao houver candidato viavel.

**Evidencia:** `src/services/distributionEngine.js`, `src/stores/studentSupport.js`, `src/services/canonicalFoundationRuntime.js`.

## Regra inferida

1. Gestor usa redistribuicao manual para tratar outliers de carga.

## Hipotese nao comprovada

1. Algoritmo final de fairness para pico de volume multiarea.

---

## 6) Escopo por perfil e permissao

## Regra confirmada no codigo

1. Guard de rota exige autenticacao (`requiresAuth`) e valida perfil/acao.
2. `mockContext` define polos/areas/filas visiveis por perfil.
3. Gestor de area tem acesso adicional a governanca e mudancas.
4. Admin central concentra permissoes de governanca global.

**Evidencia:** `src/main.js`, `src/router.js`, `src/services/mockContextRuntime.js`.

## Regra inferida

1. Em backend real, a mesma matriz deve existir em camada server-side.

## Hipotese nao comprovada

1. Design definitivo de permissionamento no Frappe (DocTypes/Roles/ACLs).

---

## 7) Snapshots e auditoria

## Regra confirmada no codigo

1. Caso registra uso de conhecimento com:
bundleVersionId, nodeId, snapshots de resposta/orientacao e ator.
2. Acoes operacionais geram eventos de caso.
3. Admin possui trilha de auditoria de mudancas de permissao.

**Evidencia:** `src/stores/studentSupport.js`, `src/repositories/runtimeRepositories.js`, `src/pages/admin/AdminPermissionsPage.vue`.

## Regra inferida

1. Auditoria permite reconstituir "o que foi respondido ao aluno" por protocolo.

## Hipotese nao comprovada

1. Politica de retencao e imutabilidade juridica da trilha em producao.

---

## 8) Regras de acao no detalhe da area

## Regra confirmada no codigo

1. Hierarquia de acao implementada:
resposta final (principal), complemento (secundaria), concluir (terciaria), encaminhamento excepcional.
2. Encaminhamento excepcional exige:
motivo estruturado, contexto verificado e area destino.
3. Concluir analise interna exige confirmacao explicita.

**Evidencia:** `src/pages/area/AreaCaseDetailPage.vue`.

## Regra inferida

1. A tela tenta induzir resolucao local antes de encaminhar.

## Hipotese nao comprovada

1. Bloqueio duro de conclusao sem resposta final em todos os cenarios de backend.

---

## 9) Regras administrativas que interferem operacao

## Regra confirmada no codigo

1. Mudanca de permissao impacta visibilidade de filas e areas.
2. Mudanca de parametro altera leitura projetada de criticidade/SLA.
3. Publicacao de bundle altera referencia de conhecimento vigente.

## Regra inferida

1. Esses tres eixos (permissao, parametro, versao) sao os principais controles de governanca.

## Hipotese nao comprovada

1. Ordem transacional entre publicacao de conhecimento e recálculo de filas em backend real.

---

## 10) Principais automatismos identificados

## Confirmados

- roteamento automatico de fila/area
- distribuicao automatica de assignment
- sugestao de assignee por score
- calculo de status SLA
- agrupamento de requests do aluno

## Inferidos

- recomendacao de proxima decisao com base no contexto do caso

## Nao comprovados

- automacao inteligente preditiva (fora do escopo atual)

