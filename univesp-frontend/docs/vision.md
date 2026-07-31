# Visao do frontend de atendimento UNIVESP

## Objetivo

Construir um frontend proprio da UNIVESP para o Sistema de Atendimento, com identidade institucional, experiencia guiada e independencia visual em relacao ao Desk padrao do Frappe.

## Contexto

- o backend e a engine operacional rodam sobre Frappe
- o frontend deve ser a camada de experiencia da UNIVESP
- o portal do atendimento e a fonte oficial da resposta ao usuario
- e-mail atua apenas como notificacao

## Experiencias principais

### Aluno e ex-aluno

- entra pelo Acesso Unificado
- navega por FAQ em arvore
- recebe resposta e registro de atendimento mesmo quando a FAQ resolve
- abre protocolo quando precisar complementar ou escalar
- acompanha status, pendencias e historico

### OP

- recebe os casos apos a triagem do portal
- trabalha com fila priorizada por SLA e criticidade
- usa FAQ operacional e playbooks antes de escalar
- pode responder, pedir complementacao ou encaminhar para area interna

### Admin e gestao

- controla filas, SLA, criticidade e regras operacionais
- governa FAQ do aluno e FAQ do OP
- acompanha indicadores, backlog e auditoria
- define permissoes e visibilidade por area

## Principios de produto

- FAQ primeiro, sem esconder a opcao de atendimento humano
- todo fluxo relevante gera registro de atendimento
- protocolo e contexto devem permanecer no portal
- handoff sem perda de informacao
- integracao futura concentrada em servicos, nao em componentes visuais

## Fora do escopo desta fase

- integracao real com backend
- autenticacao real fora do mock
- upload real de anexos
- workflow real de notificacoes
