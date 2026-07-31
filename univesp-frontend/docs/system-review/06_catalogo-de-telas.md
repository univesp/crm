# Catalogo de telas

## Escopo deste catalogo

Foram catalogadas todas as telas encontradas em `src/router.js` e suas paginas associadas em `src/pages`.
Quando nao houve print dedicado, a tela foi registrada como "documentada por codigo".

Legenda de evidencia:

- [OBS] tela observada no ambiente local e/ou print existente
- [COD] comportamento confirmado no codigo
- [INF] inferencia tecnica plausivel

---

## Tela 01 - acesso local por perfil

- Nome da tela:
Acesso local por perfil.
- Rota:
`/acesso-local/:profileKey?`
- Perfil:
uso interno de desenvolvimento.
- Objetivo:
selecionar perfil mock e entrar direto no fluxo correspondente.
- Quando aparece:
em ambiente com bypass local habilitado.
- O que o usuario ve:
cards de perfis agrupados por shell (student, operational, governance).
- O que o usuario pode fazer:
escolher perfil e redirecionar.
- Componentes e blocos:
brand/header, grupos de shell, cards de perfil.
- Campos e filtros:
sem formulario, apenas selecao por card.
- Principais decisoes/interacoes:
qual persona simular.
- Resultado esperado de cada acao:
ativar contexto mock e abrir rota default do perfil.
- Dependencias:
`authStore`, `mockContextRuntime`, `ssoClient`.
- Pontos fortes:
acelera QA funcional por papel.
- Pontos fracos:
dependencia de variavel de ambiente.
- Riscos de confusao:
baixo, por ser tela de dev.
- Sugestoes de validacao:
confirmar se perfil persistido em sessao nao contamina testes cruzados.
- Evidencia usada:
[OBS] [COD].
- Print relacionado:
`assets/screens/geral/01-acesso-local.png`

---

## Tela 02 - login institucional

- Nome da tela:
Login UNIVESP.
- Rota:
`/login`
- Perfil:
todos (entrada publica).
- Objetivo:
iniciar autenticacao institucional e classificar fluxo por email.
- Quando aparece:
usuario anonimo sem bypass local.
- O que o usuario ve:
campo email institucional e atalhos de login por fluxo.
- O que pode fazer:
enviar email, iniciar SSO, acessar modo local se habilitado.
- Componentes e blocos:
hero de autenticacao, formulario, aviso de Azure nao configurado, atalhos.
- Campos e filtros:
email (obrigatorio).
- Decisoes/interacoes:
escolha de canal de login.
- Resultado esperado:
redirect para Azure/SAML.
- Dependencias:
`authStore`, `ssoClient`.
- Pontos fortes:
entrada unica e clara.
- Pontos fracos:
mensagens tecnicas de configuracao podem poluir para usuario final se expostas.
- Riscos de confusao:
medio em ambientes mal configurados.
- Sugestoes de validacao:
teste de erro de callback e expiracao de sessao.
- Evidencia usada:
[OBS] [COD].
- Print relacionado:
`assets/screens/geral/02-login.png`

---

## Tela 03 - visao institucional

- Nome da tela:
Visao institucional.
- Rota:
`/`
- Perfil:
admin central.
- Objetivo:
contextualizar posicionamento, personas e etapas do frontend.
- Quando aparece:
apos login admin central.
- O que ve:
cards de estrategia, personas, pilares, entregas.
- O que pode fazer:
navegar para triagem e integracoes.
- Componentes:
`SectionPanel`, `MetricCard`, `StageCard`.
- Campos/filtros:
sem filtros operacionais.
- Decisoes:
priorizacao de roadmap.
- Resultado:
navegacao para modulos institucionais.
- Dependencias:
`flowBlueprint`, `frontendBlueprint`, mocks de personas.
- Pontos fortes:
boa leitura executiva.
- Pontos fracos:
nao e tela de operacao real.
- Risco:
ser confundida com dashboard operacional.
- Sugestao:
manter etiqueta de "documentacao viva".
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/06-visao-institucional-admin.png`

---

## Tela 04 - triagem institucional

- Nome da tela:
Entrada e triagem.
- Rota:
`/triagem`
- Perfil:
admin central.
- Objetivo:
demonstrar fluxo de perguntas iniciais por assunto.
- Quando aparece:
navegacao institucional.
- O que ve:
catalogo de fluxos, perguntas, snapshot para ticket.
- O que pode fazer:
escolher fluxo, responder perguntas, ir para contrato de ticket.
- Componentes:
`QuestionStep`, paines de resumo e campos minimos.
- Campos/filtros:
respostas por questao.
- Decisoes:
completar contexto minimo.
- Resultado:
contexto para pagina `/ticket`.
- Dependencias:
`journeyStore`, `attendanceFlows`.
- Pontos fortes:
didatico para desenhar intake.
- Pontos fracos:
ainda blueprint, nao intake final do produto.
- Risco:
expectativa de feature pronta de triagem final.
- Sugestao:
validar se esta tela ficara oculta em producao.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/07-triagem-admin.png`

---

## Tela 05 - contrato de ticket

- Nome da tela:
Registro do protocolo.
- Rota:
`/ticket`
- Perfil:
admin central.
- Objetivo:
mostrar payload e operacoes previstas para Frappe.
- Quando aparece:
apos triagem institucional.
- O que ve:
metricas de ticket, payload JSON, operacoes esperadas.
- O que pode fazer:
simular criacao de ticket no backend.
- Componentes:
painel de payload, painel de operacoes e notas de modelagem.
- Campos:
sem edicao principal; acao de submissao.
- Decisoes:
validar contrato frontend-backend.
- Resultado:
ticket remoto de teste e feedback de sucesso/erro.
- Dependencias:
`frappeClient`, `journeyStore`.
- Pontos fortes:
explicita contrato de integracao.
- Pontos fracos:
nao cobre ainda regras reais de negocio da operacao.
- Risco:
confundir prototipo de integracao com implementacao definitiva.
- Sugestao:
usar como base de API contract review.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/08-ticket-admin.png`

---

## Tela 06 - handoff institucional

- Nome da tela:
Escalacao humana.
- Rota:
`/handoff`
- Perfil:
admin central.
- Objetivo:
mostrar pacote de transferencia para atendimento humano.
- Quando aparece:
na trilha institucional.
- O que ve:
motivo de escalacao, pacote de dados e checklist de atendente.
- O que pode fazer:
revisar itens de handoff e seguir para integracoes.
- Componentes:
metricas, pacote narrativo, checklist e proximos passos.
- Campos/filtros:
sem campos de edicao.
- Decisoes:
qual contexto minimo deve sempre acompanhar caso escalado.
- Resultado:
orienta definicao de contrato de handoff.
- Dependencias:
`journeyStore.transferBrief`.
- Pontos fortes:
foco em continuidade de contexto.
- Pontos fracos:
sem acao operacional real.
- Risco:
baixo (tela de blueprint).
- Sugestao:
validar com operacao real se checklist e suficiente.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/09-handoff-admin.png`

---

## Tela 07 - integracoes e governanca institucional

- Nome da tela:
Integracoes e governanca.
- Rota:
`/integracoes`
- Perfil:
admin central.
- Objetivo:
documentar rotas, estrutura, SSO, variaveis e modulos.
- Quando aparece:
trilha institucional.
- O que ve:
blueprint de arquitetura e dependencias.
- O que pode fazer:
inspecionar mapas de integracao.
- Componentes:
listas de rotas, claims SAML, env vars, estrutura de pastas.
- Campos/filtros:
nao possui.
- Decisoes:
planejamento tecnico e readiness.
- Resultado:
clareza de acoplamentos e lacunas de integracao.
- Dependencias:
`flowBlueprint`, `frontendBlueprint`, `samlAuth`.
- Pontos fortes:
boa transparencia tecnica.
- Pontos fracos:
densidade de informacao alta.
- Risco:
baixa legibilidade para publico nao tecnico.
- Sugestao:
separar visao executiva e visao tecnica.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/10-integracoes-admin.png`

---

## Tela 08 - home do aluno

- Nome da tela:
Como podemos ajudar?
- Rota:
`/aluno`
- Perfil:
aluno.
- Objetivo:
entrada simples para duvida ou acompanhamento.
- Quando aparece:
aluno autenticado.
- O que ve:
cards de acao principal e busca rapida de orientacao.
- O que pode fazer:
ir para jornada, abrir solicitacoes, consultar assunto direto.
- Componentes:
cards de acesso e painel de busca.
- Campos/filtros:
campo de busca.
- Decisoes:
resolver agora ou acompanhar protocolo.
- Resultado:
navegacao para proxima etapa.
- Dependencias:
store de jornada e base de conhecimento.
- Pontos fortes:
entrada objetiva.
- Pontos fracos:
pouca contextualizacao de status sem ir para solicitacoes.
- Risco:
baixo.
- Sugestao:
medir uso da busca versus navegacao por temas.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/aluno/01-home-aluno.png`

---

## Tela 09 - jornada de duvida do aluno

- Nome da tela:
Tenho uma duvida.
- Rota:
`/aluno/duvida`
- Perfil:
aluno.
- Objetivo:
resolver por orientacao antes de abrir protocolo.
- Quando aparece:
acao da home do aluno.
- O que ve:
arvore de assuntos/subassuntos e respostas.
- O que pode fazer:
avancar em nos, voltar e decidir abrir protocolo.
- Componentes:
cards de no, breadcrumbs/estado atual, CTA de continuidade.
- Campos:
selecao de no.
- Decisoes:
resolvido via FAQ ou seguir para protocolo.
- Resultado:
encerramento em autosservico ou transicao para formulario.
- Dependencias:
knowledge bundle vigente.
- Pontos fortes:
apoia deflexao de demanda.
- Pontos fracos:
se no final for vago, usuario avanca sem clareza.
- Risco:
medio em cobertura de conteudo.
- Sugestao:
validar qualidade de resposta por tema critico.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/aluno/02-jornada-duvida.png`

---

## Tela 10 - minhas solicitacoes

- Nome da tela:
Minhas solicitacoes.
- Rota:
`/aluno/solicitacoes`
- Perfil:
aluno.
- Objetivo:
acompanhar todos os protocolos e pendencias.
- Quando aparece:
navegacao do aluno.
- O que ve:
lista agrupada por status (rascunho, acao requerida, aguardando, concluidos).
- O que pode fazer:
filtrar, abrir detalhe, retomar rascunho.
- Componentes:
cards/lista com status e prazo.
- Campos/filtros:
busca e recorte por periodo/status.
- Decisoes:
qual protocolo priorizar.
- Resultado:
navegacao para detalhe.
- Dependencias:
runtime de requests do aluno.
- Pontos fortes:
boa visibilidade de pendencias.
- Pontos fracos:
pode ficar extensa sem paginacao server-side.
- Risco:
medio em escala.
- Sugestao:
validar paginação e ordenacao por urgencia.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/aluno/03-minhas-solicitacoes.png`

---

## Tela 11 - detalhe da solicitacao do aluno

- Nome da tela:
Detalhe da solicitacao.
- Rota:
`/aluno/solicitacoes/:protocolId`
- Perfil:
aluno.
- Objetivo:
mostrar historico, proximo passo e formulario de complemento.
- Quando aparece:
abertura de item da lista.
- O que ve:
timeline, status atual, orientacao de acao e anexos.
- O que pode fazer:
enviar informacao complementar quando solicitado.
- Componentes:
cabecalho do protocolo, bloco de proximo passo, historico.
- Campos/filtros:
textarea e possivel anexo de follow-up.
- Decisoes:
responder agora ou aguardar.
- Resultado:
complemento registrado no caso.
- Dependencias:
`studentSupportFlow` e store central.
- Pontos fortes:
explica "o que fazer agora".
- Pontos fracos:
status complexos podem exigir legenda.
- Risco:
medio de interpretacao.
- Sugestao:
testar entendimento em usuario sem perfil tecnico.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/aluno/04-detalhe-solicitacao.png`

---

## Tela 12 - formulario de protocolo do aluno

- Nome da tela:
Continuar com a solicitacao.
- Rota:
`/aluno/protocolo`
- Perfil:
aluno.
- Objetivo:
finalizar abertura de caso.
- Quando aparece:
apos jornada de duvida ou acesso direto.
- O que ve:
resumo do assunto, formulario de descricao e anexos.
- O que pode fazer:
editar conteudo, validar e enviar.
- Componentes:
bloco de contexto, campos obrigatorios, CTA de enviar.
- Campos:
descricao, anexos, dados complementares.
- Decisoes:
enviar ou voltar para ajustar.
- Resultado:
protocolo criado e redirecionamento para confirmacao.
- Dependencias:
validacao de draft e submissao.
- Pontos fortes:
fluxo direto.
- Pontos fracos:
sem backend real, confirmacao depende de mock.
- Risco:
baixo no prototipo; medio na integracao.
- Sugestao:
validar mensagens de erro de rede/backend.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/aluno/05-abertura-protocolo.png`

---

## Tela 13 - confirmacao de envio do aluno

- Nome da tela:
Confirmacao.
- Rota:
`/aluno/confirmacao/:protocolId`
- Perfil:
aluno.
- Objetivo:
confirmar resultado de envio e orientar proximo passo.
- Quando aparece:
apos submit de protocolo ou resolucao guiada.
- O que ve:
mensagem de confirmacao e referencia do protocolo.
- O que pode fazer:
seguir para acompanhamento.
- Componentes:
card de confirmacao e CTA de continuidade.
- Campos/filtros:
nao possui.
- Decisoes:
ir para lista de solicitacoes.
- Resultado:
encerramento da etapa de abertura.
- Dependencias:
estado de submissao.
- Pontos fortes:
fecha ciclo com feedback.
- Pontos fracos:
sem print dedicado no pacote atual.
- Risco:
baixo.
- Sugestao:
validar condicao para protocolo invalido na URL.
- Evidencia usada:
[COD] (sem observacao visual dedicada nesta rodada).
- Print relacionado:
documentado por codigo.

---

## Tela 14 - fila OP (orientador de polo)

- Nome da tela:
Atendimentos.
- Rota:
`/op/fila`
- Perfil:
op e gestor_polos.
- Objetivo:
operar backlog do polo.
- Quando aparece:
entrada operacional.
- O que ve:
buckets, filtros, tabela/lista de casos, SLA, prioridade.
- O que pode fazer:
filtrar, buscar, abrir caso.
- Componentes:
chips de bucket, filtros rapidos, tabela com CTA "Abrir".
- Campos/filtros:
busca, status, responsavel, bucket.
- Decisoes:
qual caso abrir primeiro.
- Resultado:
navegacao para detalhe.
- Dependencias:
`operatorQueueRuntime`.
- Pontos fortes:
visao operacional objetiva.
- Pontos fracos:
densidade visual pode subir com muitos campos.
- Risco:
medio em escala se nao houver virtualizacao/paginacao.
- Sugestao:
validar performance com volume alto.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/01-fila-op.png`

---

## Tela 15 - detalhe do caso OP

- Nome da tela:
Analise do caso (OP).
- Rota:
`/op/fila/:caseId`
- Perfil:
op e gestor_polos.
- Objetivo:
tomar decisao operacional com contexto completo.
- Quando aparece:
acao "Abrir" na fila.
- O que ve:
resumo, historico, orientacao e bloco de acao.
- O que pode fazer:
responder, pedir complemento, escalar.
- Componentes:
header do caso, secoes de contexto, painel de decisao.
- Campos:
texto de resposta/solicitacao, selecao de destino em escalonamento.
- Decisoes:
resolver na camada OP ou escalar.
- Resultado:
evento operacional registrado e status atualizado.
- Dependencias:
store central, knowledge usage, routing.
- Pontos fortes:
integra contexto e acao na mesma tela.
- Pontos fracos:
requer disciplina de preenchimento para rastreabilidade forte.
- Risco:
medio em acoes sem checklist obrigatorio.
- Sugestao:
validar bloqueios para evitar escalonamento sem justificativa.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/02-detalhe-caso-op.png`

---

## Tela 16 - consultar orientacao OP

- Nome da tela:
Consultar orientacao.
- Rota:
`/op/playbook`
- Perfil:
op e gestor_polos.
- Objetivo:
consultar FAQ/playbook sem abrir caso novo.
- Quando aparece:
menu operacional.
- O que ve:
busca, navegacao por tema/subtema e orientacao operacional.
- O que pode fazer:
consultar orientacao, abrir fluxo de atendimento assistido.
- Componentes:
lista de assuntos, bloco de resposta, CTA para novo atendimento.
- Campos/filtros:
campo de busca por assunto.
- Decisoes:
usar orientacao para responder ou abrir caso assistido.
- Resultado:
apoio a atendimento em curso ou criacao de novo caso.
- Dependencias:
knowledge runtime.
- Pontos fortes:
alto valor de consulta rapida.
- Pontos fracos:
se busca nao achar termos sinonimos, pode frustrar.
- Risco:
medio de coverage sem motor semantico.
- Sugestao:
validar sinonimos e termos operacionais regionais.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/03-consultar-orientacao-op.png`

---

## Tela 17 - abrir atendimento em nome do aluno (OP)

- Nome da tela:
Abrir atendimento em nome do aluno.
- Rota:
`/op/novo-atendimento`
- Perfil:
op e gestor_polos.
- Objetivo:
registrar intake assistido com trilha formal.
- Quando aparece:
menu operacional.
- O que ve:
wizard de identificacao, classificacao e confirmacao.
- O que pode fazer:
localizar aluno, definir assunto, registrar verificacoes e submeter.
- Componentes:
etapas, campos de contexto, resumo final.
- Campos/filtros:
RA/nome, assunto, justificativa, acao desejada.
- Decisoes:
abrir, complementar ou escalar.
- Resultado:
novo protocolo com contexto estruturado.
- Dependencias:
dados de aluno e knowledge path.
- Pontos fortes:
formaliza atendimento assistido.
- Pontos fracos:
processo pode ficar longo sem autosave.
- Risco:
medio de abandono.
- Sugestao:
validar tempo medio da jornada assistida.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/04-abrir-atendimento-op.png`

---

## Tela 18 - fila gestor de polos

- Nome da tela:
Atendimentos (escopo gestor de polos).
- Rota:
`/op/fila`
- Perfil:
gestor_polos.
- Objetivo:
mesma operacao do OP com visao ampliada.
- Quando aparece:
perfil gestor_polos autenticado.
- O que ve:
fila com abrangencia maior de polos.
- O que pode fazer:
mesmas acoes do OP.
- Componentes:
iguais ao modulo OP.
- Campos/filtros:
iguais ao modulo OP.
- Decisoes:
priorizacao por multiplos polos.
- Resultado:
abertura de detalhe/acao.
- Dependencias:
mockContext com linkedPolos ampliado.
- Pontos fortes:
reuso de interface.
- Pontos fracos:
diferencial gerencial baixo.
- Risco:
sobreposicao de papel.
- Sugestao:
avaliar home gerencial propria para gestor de polos.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/05-fila-gestor-polos.png`

---

## Tela 19 - detalhe gestor de polos

- Nome da tela:
Analise do caso (gestor de polos).
- Rota:
`/op/fila/:caseId`
- Perfil:
gestor_polos.
- Objetivo:
atuar em caso com escopo ampliado.
- Quando aparece:
abertura de caso na fila do gestor de polos.
- O que ve:
mesma estrutura do detalhe OP.
- O que pode fazer:
mesmas acoes operacionais.
- Componentes:
iguais ao OP.
- Campos/filtros:
iguais ao OP.
- Decisoes:
resolver/pedir complemento/escalar.
- Resultado:
trilha operacional registrada.
- Dependencias:
runtime OP.
- Pontos fortes:
consistencia de treinamento.
- Pontos fracos:
falta camada explicitamente gerencial.
- Risco:
gestor operar como atendente.
- Sugestao:
incluir visao consolidada por polo para esse perfil no futuro.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/orientador/06-detalhe-gestor-polos.png`

---

## Tela 20 - home gerencial de area

- Nome da tela:
Operacao da area.
- Rota:
`/area/operacao`
- Perfil:
gestor_area.
- Objetivo:
dar leitura consolidada da saude operacional da area.
- Quando aparece:
entrada padrao do gestor de area.
- O que ve:
KPIs de backlog, risco SLA, sem responsavel, distribuicao e gargalos.
- O que pode fazer:
navegar para fila, governanca e mudancas pendentes.
- Componentes:
cards KPI, listas de excecao, atalhos de intervencao.
- Campos/filtros:
filtros por area/status/assunto (conforme runtime).
- Decisoes:
onde intervir primeiro.
- Resultado:
acao gerencial mais rapida.
- Dependencias:
`areaManagerRuntime` + store canonico.
- Pontos fortes:
diferencia papel de gestor.
- Pontos fracos:
a qualidade dos KPIs depende da consistencia do runtime.
- Risco:
medio sem backend analitico consolidado.
- Sugestao:
validar 5 KPIs realmente acionaveis e remover ruído.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/gestor/01-home-gestor-area.png`

---

## Tela 21 - fila da area (analista/gestor)

- Nome da tela:
Casos da area.
- Rota:
`/area/fila`
- Perfil:
analista_area e gestor_area.
- Objetivo:
listar casos da area com recorte por ownership e status.
- Quando aparece:
menu "Casos da area".
- O que ve:
chips de escopo (meus, sem responsavel, aguardando complemento, concluidos), filtros e tabela.
- O que pode fazer:
filtrar, atualizar e abrir caso.
- Componentes:
atalhos de escopo, filtros, tabela com contexto recebido do OP.
- Campos/filtros:
busca, status, responsavel, atalho de bucket/escopo.
- Decisoes:
prioridade de atuacao.
- Resultado:
navegacao para detalhe.
- Dependencias:
`areaQueueRuntime`.
- Pontos fortes:
reforca ownership e resolucao.
- Pontos fracos:
depende da area selecionada no header para consistencia.
- Risco:
medio de tela vazia em URL com area divergente.
- Sugestao:
enforce de area canonica na URL e fallback mais robusto.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/analista/01-fila-analista-area.png`, `assets/screens/gestor/02-fila-gestor-area.png`

---

## Tela 22 - detalhe da analise da area

- Nome da tela:
Analise da area.
- Rota:
`/area/fila/:caseId`
- Perfil:
analista_area e gestor_area.
- Objetivo:
conduzir decisao tecnica com baixo erro.
- Quando aparece:
acao "Abrir" na fila da area.
- O que ve:
ordem cognitiva de decisao (resumo, contexto OP, antes de decidir, orientacao, resposta, historico).
- O que pode fazer:
enviar resposta ao aluno/OP, pedir complemento, concluir analise interna, encaminhar excepcionalmente.
- Componentes:
blocos de pre-decisao, sugestao de saida, formulario de acao, confirmacao.
- Campos/filtros:
texto de resposta, motivo estruturado de excecao, area destino, checklist de conclusao.
- Decisoes:
qual acao aplicar e se existe excecao real.
- Resultado:
evento de area, atualizacao de status/assignment/routing/knowledge usage.
- Dependencias:
`areaQueueRuntime`, store, regras de escopo/assignment.
- Pontos fortes:
hierarquia de acao explicita e reencaminhamento rebaixado.
- Pontos fracos:
carga textual ainda alta em algumas secoes.
- Risco:
acao inconsistente se dados de caso estiverem incompletos.
- Sugestao:
fortalecer bloqueio para concluir sem resposta final ao aluno.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/analista/02-detalhe-analista-area.png`, `assets/screens/gestor/03-detalhe-gestor-area.png`

---

## Tela 23 - detalhe de area vazio (erro/edge observado)

- Nome da tela:
Analise da area sem conteudo.
- Rota:
`/area/fila/:caseId` (cenario com mismatch de area/escopo).
- Perfil:
analista_area ou gestor_area.
- Objetivo:
nao e objetivo funcional; representa estado de falha observado.
- Quando aparece:
quando caso nao e resolvido no escopo/area da URL.
- O que ve:
estrutura vazia sem corpo do caso.
- O que pode fazer:
voltar para fila.
- Componentes:
somente shell e navegacao.
- Campos/filtros:
nao possui.
- Decisoes:
recuperar contexto correto.
- Resultado:
risco de bloqueio operacional.
- Dependencias:
resolucao de caso por area (`areaCaseById` + `areaQueueRuntime`).
- Pontos fortes:
nenhum relevante.
- Pontos fracos:
estado de erro sem mensagem explicita.
- Risco:
alto para confianca do operador.
- Sugestao:
mostrar mensagem clara de "caso fora do escopo selecionado" com CTA de correcao.
- Evidencia:
[OBS].
- Print:
`assets/screens/analista/03-detalhe-analista-vazio.png`

---

## Tela 24 - conteudo vigente da area

- Nome da tela:
Conteudo vigente da area.
- Rota:
`/area/orientacao`
- Perfil:
analista_area e gestor_area.
- Objetivo:
consultar orientacao por assunto/subassunto e registrar sugestao.
- Quando aparece:
menu "Conteudo vigente".
- O que ve:
lista de conteudo aprovado, detalhe do no e formulario de sugestao.
- O que pode fazer:
consultar e sugerir melhoria.
- Componentes:
painel de busca/seletores, painel de orientacao, painel de sugestao.
- Campos/filtros:
tema, subassunto, texto da sugestao, tipo de ajuste.
- Decisoes:
quando abrir sugestao de correcao.
- Resultado:
sugestao entra em `Pending Review`.
- Dependencias:
knowledge bundle publicado e store de sugestoes.
- Pontos fortes:
conecta operacao com melhoria continua.
- Pontos fracos:
pode competir com foco de atendimento se acessado no meio da decisao.
- Risco:
medio de dispersao cognitiva.
- Sugestao:
manter consulta leve; sugestao detalhada pode ser assicrona.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/analista/04-conteudo-vigente-analista.png`, `assets/screens/gestor/04-conteudo-vigente-gestor.png`

---

## Tela 25 - mudancas pendentes da area

- Nome da tela:
Mudancas pendentes.
- Rota:
`/area/mudancas`
- Perfil:
gestor_area.
- Objetivo:
revisar, aprovar ou rejeitar sugestoes operacionais.
- Quando aparece:
menu do gestor de area.
- O que ve:
fila de sugestoes com status e detalhe.
- O que pode fazer:
aprovar/rejeitar e registrar justificativa.
- Componentes:
lista de sugestoes, detalhe da proposta, botoes de decisao.
- Campos/filtros:
status, assunto, autor, texto de review.
- Decisoes:
aceitar ou recusar melhoria proposta.
- Resultado:
mudanca de status da sugestao e trilha de review.
- Dependencias:
`knowledgeSuggestions`, `knowledgeSuggestionReviews`.
- Pontos fortes:
governanca clara.
- Pontos fracos:
sem comparador de versao visual nesta fase.
- Risco:
medio de decisao manual lenta em alto volume.
- Sugestao:
priorizacao por impacto/repeticao de tema.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/gestor/05-mudancas-pendentes-gestor.png`

---

## Tela 26 - regras operacionais da area

- Nome da tela:
Regras operacionais da area.
- Rota:
`/area/governanca`
- Perfil:
gestor_area.
- Objetivo:
configurar visibilidade por assunto e disponibilidade do time.
- Quando aparece:
menu do gestor de area.
- O que ve:
regras de assunto/subassunto, disponibilidade e capacidade.
- O que pode fazer:
editar elegibilidade, restringir assuntos, registrar ausencia/ferias/licenca.
- Componentes:
formularios de regra, listas de configuracao e historico.
- Campos/filtros:
area, assunto, subassunto, modo de acesso, usuarios elegiveis, janela temporal.
- Decisoes:
quem pode ver/atuar e quando.
- Resultado:
impacta distribuicao automatica e escopo de fila.
- Dependencias:
`areaSubjectEligibilityRules`, `userAvailabilityCatalog`.
- Pontos fortes:
regra operacional explicita, nao apenas filtro visual.
- Pontos fracos:
configuracao pode ser complexa sem assistente.
- Risco:
alto se regra mal configurada bloquear atendimento.
- Sugestao:
incluir simulacao de impacto antes de salvar.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/gestor/06-regras-operacionais-gestor.png`

---

## Tela 27 - dashboard admin central

- Nome da tela:
Dashboard geral.
- Rota:
`/admin/dashboard`
- Perfil:
admin_central.
- Objetivo:
leitura executiva de operacao com filtros.
- Quando aparece:
menu admin.
- O que ve:
KPIs, resumo por fila, auditoria, casos de atencao e cards de governanca.
- O que pode fazer:
filtrar por fila/status/criticidade/tema.
- Componentes:
metric cards, listas executivas, trilha de auditoria.
- Campos/filtros:
filtros globais de leitura.
- Decisoes:
onde atacar risco operacional.
- Resultado:
priorizacao de acao administrativa.
- Dependencias:
`adminDashboardRuntime`.
- Pontos fortes:
painel acionavel, nao apenas estetico.
- Pontos fracos:
depende de qualidade de dados unificada.
- Risco:
medio em divergencia de status entre modulos.
- Sugestao:
definir KPI canonico e dicionario de metricas.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/01-dashboard-admin.png`

---

## Tela 28 - gestao da FAQ admin

- Nome da tela:
Gestao da FAQ.
- Rota:
`/admin/faq`
- Perfil:
admin_central.
- Objetivo:
editar arvore de conhecimento e highlights.
- Quando aparece:
menu admin.
- O que ve:
arvore de nos, editor de campos, relacoes, validacao, calendario.
- O que pode fazer:
alterar tema/subtema/pergunta/resposta, links e metadados operacionais.
- Componentes:
arvore, editor de no, editor de highlight, painel de governanca.
- Campos/filtros:
diversos campos estruturados e listas.
- Decisoes:
conteudo e regra operacional por no.
- Resultado:
rascunho atualizado para fluxo de versao/publicacao.
- Dependencias:
`adminFaqBuilderRuntime`.
- Pontos fortes:
estrutura rica e alinhada ao modelo.
- Pontos fracos:
alta densidade para uso sem treinamento.
- Risco:
alto de erro humano em edicao extensa.
- Sugestao:
camada simplificada para edicao por planilha/import assistido.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/02-faq-admin.png`

---

## Tela 29 - parametros de SLA e criticidade

- Nome da tela:
Parametros de SLA e criticidade.
- Rota:
`/admin/parametros`
- Perfil:
admin_central.
- Objetivo:
definir niveis oficiais e regras de aplicacao.
- Quando aparece:
menu admin.
- O que ve:
niveis, regras por alvo e impacto projetado.
- O que pode fazer:
editar niveis, alterar regras, ativar/desativar.
- Componentes:
listas de nivel, editor, painel de impacto por fila/caso.
- Campos/filtros:
label, badge, cor, horas, prioridade, targetType/targetValue.
- Decisoes:
como leitura de risco sera aplicada.
- Resultado:
runtime passa a projetar nova criticidade/SLA.
- Dependencias:
`adminParametersRuntime`.
- Pontos fortes:
explicita impacto antes da mudanca.
- Pontos fracos:
sem persistencia backend real nesta fase.
- Risco:
medio-alto se migracao para backend nao respeitar mesmas regras.
- Sugestao:
versionar tambem parametros (nao so conhecimento).
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/03-parametros-admin.png`

---

## Tela 30 - permissoes e visibilidade admin

- Nome da tela:
Permissoes e visibilidade.
- Rota:
`/admin/permissoes`
- Perfil:
admin_central.
- Objetivo:
gerenciar matriz de acesso por perfil/escopo e trilha de auditoria.
- Quando aparece:
menu admin.
- O que ve:
impacto por perfil, matriz de politicas, editor e logs.
- O que pode fazer:
alterar perfil, escopo e acoes permitidas.
- Componentes:
cards de impacto, lista de entradas, formulario de edicao, auditoria.
- Campos/filtros:
scopeType, scopeValues, allowedActions, nota.
- Decisoes:
quem ve o que e quem pode agir.
- Resultado:
atualizacao da matriz e registro de auditoria.
- Dependencias:
`adminPermissionsRuntime`.
- Pontos fortes:
separa visibilidade e governanca por perfil.
- Pontos fracos:
modelo complexo para manutencao manual em grande escala.
- Risco:
alto de configuracao incorreta com impacto amplo.
- Sugestao:
introduzir templates de permissao por perfil e validacao automatica.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/04-permissoes-admin.png`

---

## Tela 31 - publicacao e historico de versoes

- Nome da tela:
Publicacao e historico de versoes.
- Rota:
`/admin/publicacao`
- Perfil:
admin_central.
- Objetivo:
aprovar/publicar versoes canonicas de bundles de conhecimento.
- Quando aparece:
menu admin.
- O que ve:
bundles, versoes, status, snapshots e historico de publicacao.
- O que pode fazer:
aprovar versao, publicar versao.
- Componentes:
metricas, cards de bundle, lista de versoes e painel de acao.
- Campos/filtros:
selecao de bundle e versao.
- Decisoes:
quando uma versao vira referencia ativa.
- Resultado:
alteracao de versao publicada no runtime canonico.
- Dependencias:
`runtimeRepositories`, `knowledgeFoundation`, store.
- Pontos fortes:
workflow de publicacao visivel e controlado.
- Pontos fracos:
texto com problema de encoding em labels de algumas strings (ex.: "canÃ´nico").
- Risco:
baixo funcional, medio de qualidade visual/documental.
- Sugestao:
normalizar encoding UTF-8 e manter padrao de nomenclatura.
- Evidencia:
[OBS] [COD].
- Print:
`assets/screens/admin/05-publicacao-admin.png`

---

## Tela 32 - wireframe navegavel do aluno

- Nome da tela:
Wireframe navegavel do aluno.
- Rota:
`/wireframes/aluno/:screenId?`
- Perfil:
uso interno de design/produto.
- Objetivo:
iteracao rapida de UX de aluno fora da operacao principal.
- Quando aparece:
acesso direto por rota.
- O que ve:
varia por `screenId`.
- O que pode fazer:
navegar cenarios de wireframe.
- Componentes:
layout de wireframe.
- Campos/filtros:
dependente de implementacao da pagina.
- Decisoes:
avaliacao exploratoria de UX.
- Resultado:
material de prototipacao.
- Dependencias:
`StudentWireframePage.vue`.
- Pontos fortes:
apoia validacao rapida.
- Pontos fracos:
nao e fluxo oficial de operacao.
- Risco:
confundir prototipo com produto final.
- Sugestao:
restringir visibilidade em ambiente produtivo.
- Evidencia:
[COD] (sem print dedicado nesta rodada).
- Print relacionado:
documentado por codigo.

