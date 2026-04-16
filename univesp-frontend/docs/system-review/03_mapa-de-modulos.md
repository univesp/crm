# Mapa de modulos

## Leitura geral

Este mapa lista modulos funcionais identificados no frontend atual, com objetivo, publico, entradas, saidas e riscos de entendimento.

## 1) Acesso local e autenticacao

### Modulo: acesso local por perfil

- Objetivo:
permitir navegacao local em modo mock por perfil sem depender de SSO real.
- Publico:
time de produto, design, QA, engenharia.
- Entradas:
selecionar perfil (`aluno`, `op`, `gestor_polos`, `analista_area`, `gestor_area`, `admin_central`).
- Saidas:
ativacao de contexto mock e redirecionamento para rota default do perfil.
- Acoes:
escolher perfil, redirecionar, limpar contexto.
- Dependencias:
`VITE_SSO_DEV_BYPASS`, `authStore`, `mockAccessProfiles`.
- Impacto operacional:
alto para validacao rapida de fluxos.
- Risco UX:
baixo no dev; nulo em producao (rota nao e para usuario final).

### Modulo: login institucional

- Objetivo:
iniciar fluxo SSO (Azure/SAML) e classificar entrada por email institucional.
- Publico:
usuarios finais em ambiente integrado.
- Entradas:
email e flow de autenticacao.
- Saidas:
redirecionamento para provedor e sessao autenticada.
- Dependencias:
`ssoClient`, variaveis de ambiente de SSO.
- Risco:
medio se variaveis de ambiente estiverem inconsistentes.

## 2) Modulo aluno

### Submodulo: home do aluno

- Objetivo:
dar caminho rapido entre "tirar duvida" e "acompanhar solicitacoes".
- Entradas:
contexto de aluno autenticado.
- Saidas:
navegacao para jornada guiada ou lista de protocolos.
- Acoes:
busca rapida de orientacao, abrir jornada, abrir solicitacoes.
- Dependencias:
knowledge base e request runtime.
- Risco UX:
baixo.

### Submodulo: jornada guiada / FAQ

- Objetivo:
resolver demanda sem protocolo quando possivel.
- Entradas:
tema/subtema/no da arvore.
- Saidas:
resposta orientada ou continuidade para protocolo.
- Acoes:
navegacao por nos, consulta de resposta, avancar para abertura de caso.
- Dependencias:
bundle de conhecimento vigente.
- Risco UX:
medio se arvore ficar muito profunda sem resumo contextual.

### Submodulo: abertura de protocolo

- Objetivo:
formalizar caso quando autosservico nao resolve.
- Entradas:
contexto FAQ + descricao + anexos.
- Saidas:
protocolo com trilha inicial e confirmacao.
- Acoes:
editar resumo, anexar, enviar.
- Dependencias:
validacao de draft, submissao de protocolo.
- Risco:
medio se nao houver feedback forte de erro de campo.

### Submodulo: acompanhamento e detalhe

- Objetivo:
dar transparencia de status, pendencia e proximo passo.
- Entradas:
lista de protocolos do aluno.
- Saidas:
detalhe com timeline e resposta de follow-up.
- Risco:
baixo para entendimento; medio para escala se agrupamento de lista nao tiver paginacao server-side no futuro.

## 3) Modulo orientador de polo (OP) e gestor de polos

### Submodulo: fila OP

- Objetivo:
priorizar e operar casos do polo com filtros e buckets.
- Entradas:
casos visiveis por polo/perfil.
- Saidas:
abertura de detalhe e acao operacional registrada.
- Acoes:
filtrar, ordenar, abrir caso, atualizar.
- Dependencias:
runtime de fila OP, status SLA, eventos.
- Risco UX:
medio se excesso de chips/filtros sem padrao de prioridade.

### Submodulo: detalhe do caso OP

- Objetivo:
analisar contexto, consultar orientacao e decidir acao.
- Entradas:
caso selecionado da fila.
- Saidas:
resposta, solicitacao de complemento ou escalonamento.
- Acoes:
registrar resposta, pedir complemento, escalar area.
- Dependencias:
playbook operacional, timeline e handoff.
- Risco:
medio-alto em acao errada se criterios nao estiverem bem estruturados em backend.

### Submodulo: consultar orientacao OP

- Objetivo:
consultar FAQ/playbook sem abrir caso novo.
- Entradas:
busca por tema e selecao de no.
- Saidas:
orientacao de atendimento e possibilidade de abrir atendimento assistido.
- Risco:
baixo, com bom valor operacional.

### Submodulo: abrir atendimento em nome do aluno

- Objetivo:
permitir intake assistido pelo OP com trilha estruturada.
- Entradas:
identificacao do aluno + assunto + evidencias.
- Saidas:
abertura de caso ou acao orientada.
- Dependencias:
diretorio de aluno mock e rota de submissao.
- Risco:
medio se validacoes de campo obrigatorio nao espelharem contrato backend real.

## 4) Modulo area (analista e gestor de area)

### Submodulo: home gerencial da area

- Objetivo:
dar leitura consolidada de backlog, risco, sem responsavel e gargalos.
- Publico:
gestor de area.
- Saidas:
intervencao gerencial, redistribuicao e acao sobre governanca.
- Risco:
baixo no desenho atual; depende de KPI canonico no backend.

### Submodulo: fila da area

- Objetivo:
organizar casos da area com recortes de ownership e status.
- Publico:
analista e gestor de area.
- Entradas:
area selecionada, filtros, escopo de visibilidade.
- Saidas:
abertura do detalhe da area.
- Risco:
medio em casos de URL sem area consistente, observado em relatos anteriores de tela vazia.

### Submodulo: detalhe da analise da area

- Objetivo:
guiar decisao tecnica com foco em resolver (nao repassar).
- Estrutura principal:
resumo, contexto OP, antes de decidir, orientacao rapida, resposta da area, historico.
- Hierarquia de acao:
resposta final > complemento > conclusao interna > encaminhamento excepcional.
- Dependencias:
playbook, evidencias, assignment, routing decision.
- Risco:
medio quando dados de caso chegam incompletos ou fora do escopo da area selecionada.

### Submodulo: conteudo vigente da area

- Objetivo:
consultar base vigente por assunto/subassunto e abrir sugestao de melhoria.
- Publico:
analista e gestor.
- Saidas:
sugestao para trilha de review/aprovacao.

### Submodulo: mudancas pendentes

- Objetivo:
revisar/aprovar/rejeitar sugestoes de conhecimento.
- Publico:
gestor de area.
- Saidas:
decisao de governanca registrada.

### Submodulo: regras operacionais da area

- Objetivo:
definir visibilidade por assunto/subassunto e disponibilidade das pessoas.
- Publico:
gestor de area.
- Saidas:
regras que impactam distribuicao e escopo.
- Risco:
medio em configuracao manual sem simulacao de impacto em massa.

## 5) Modulo admin central

### Submodulo: dashboard geral

- Objetivo:
visao executiva de backlog, criticidade, SLA, escalonamentos e auditoria.
- Entradas:
filtros por fila/status/criticidade/tema.
- Saidas:
leitura de risco e priorizacao de governanca.

### Submodulo: gestao da FAQ

- Objetivo:
editar arvore, links, highlights e campos operacionais.
- Dependencias:
runtimes de FAQ builder.
- Risco:
medio-alto de complexidade para usuario nao tecnico sem camada simplificada.

### Submodulo: parametros (SLA e criticidade)

- Objetivo:
definir niveis oficiais e regras de aplicacao por tema/subtema/fila.
- Saidas:
impacto projetado em casos ativos.

### Submodulo: permissoes e visibilidade

- Objetivo:
manter matriz de escopo e acoes permitidas por perfil.
- Saidas:
auditoria de mudanca administrativa.

### Submodulo: publicacao e historico

- Objetivo:
aprovar e publicar versoes canonicas de conhecimento.
- Saidas:
versao ativa para uso operacional.

## 6) Modulo institucional (demonstrativo)

### Paginas: visao institucional, triagem, ticket, handoff, integracoes

- Objetivo:
mostrar blueprint de produto, dependencias e contrato de integracao.
- Publico:
gestao/admin/projeto.
- Observacao:
nao sao o fluxo operacional final de producao; funcionam como documentacao viva em runtime.

