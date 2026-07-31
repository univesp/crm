# Fundacao funcional do frontend UNIVESP

## Objetivo desta fase

Estruturar a camada frontend institucional dentro de `univesp-frontend` para que o time consiga evoluir telas e integracoes sem refazer a base a cada etapa.

Esta fase nao assume backend real. O foco aqui e:

- documentacao funcional viva
- organizacao de mocks
- clareza de rotas, paginas e componentes
- definicao de fluxos de atendimento
- preparacao para experiencias de aluno, operacao OP e gestao

## Personas priorizadas

### Aluno

- entra autenticado via SSO
- nao deve repetir RA, polo, curso e dados basicos
- precisa entender protocolo, status e proximo passo

### Operacao OP

- precisa receber motivo, urgencia, evidencias e fila correta
- deve assumir o caso com briefing pronto
- nao deve reiniciar a coleta feita na triagem

### Gestao e admin

- precisa visualizar dependencias, ownership e gargalos
- acompanha o que ainda e mock e o que depende de backend real
- orienta a priorizacao do MVP

## Jornada funcional atual

1. Home institucional: posiciona o produto e as personas.
2. Triagem: coleta intencao, urgencia e evidencias.
3. Ticket: define o payload previsto para Frappe.
4. Atendimento assistido: ilustra o uso de IA com contexto.
5. Handoff humano: mostra o pacote operacional para escalacao.
6. Integracoes e governanca: documenta ambiente, SSO, estrutura e dependencias.
7. Home do aluno: prepara FAQ, notificacoes e acesso a protocolos.
8. Fila do OP: organiza prioridade, SLA e acao operacional.
9. Dashboard admin: consolida backlog, FAQ e governanca.

## Estrutura de dados mockados

- `mocks/personas.js`: personas e jornadas por perfil
- `mocks/journey.js`: sessao, cliente e respostas mockadas
- `mocks/knowledgeBase.js`: FAQ do aluno, playbook do OP e snapshot de governanca
- `mocks/operations.js`: protocolos, notificacoes, filas e dashboard
- `src/data/flowBlueprint.js`: fluxo base e estrutura funcional da jornada
- `src/data/frontendBlueprint.js`: arquitetura de rotas, areas e componentes

## Limites desta fase

- sem integracao real com Frappe
- sem SSO real
- sem credenciais, segredos ou endpoints institucionais
- sem alteracoes fora de `univesp-frontend`

## Dependencias externas mapeadas, mas nao implementadas

- definicao do DocType real no Frappe
- endpoints REST e metodos de persistencia do ticket
- orquestrador de IA e base de conhecimento
- assertion consumer SAML e mapeamento do IdP
- mecanismo real de fila e handoff humano

## Ordem sugerida para a proxima implementacao visual

1. consolidar a area do aluno como entrada principal
2. criar workspace da operacao OP com fila e resumo do caso
3. criar visao de gestao com blocos de governanca e indicadores
4. substituir mocks por contratos formais de API quando o backend estiver pronto
