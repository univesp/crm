# Planejamento de APIs Frappe

## Objetivo

Registrar a recomendacao inicial para conectar o frontend Vue ao Frappe CRM, mantendo o Frappe como engine de dados e workflow, o SSO Gateway como camada de autenticacao, e o frontend como experiencia por perfil.

Este documento consolida as decisoes atuais e os pontos que ainda dependem de confirmacao do time UNIVESP/TI.

## Arquitetura recomendada

- o navegador autentica pelo SSO institucional
- o frontend consulta a sessao em `/api/me`
- o frontend consome APIs do Frappe pela mesma origem, via proxy reverso
- regras sensiveis ficam validadas no Frappe/backend, mesmo quando a visibilidade tambem existir no frontend

Rotas esperadas:

- `/login`: entrada SSO e selecao de fluxo
- `/api/me`: sessao autenticada pelo SSO Gateway
- `/api/method/univesp.api.*`: APIs customizadas do Frappe
- `/api/resource/*`: uso restrito, apenas quando houver permissao clara e baixo risco
- `/crm`, `/app`, `/desk`: interface Frappe/CRM para operacao tecnica ou administrativa

Nao colocar segredo do Frappe em variaveis `VITE_*`. Tudo que entra no bundle do frontend deve ser considerado publico.

## Recomendacao de implementacao no Frappe

Criar uma camada propria de APIs, preferencialmente em um app Frappe da UNIVESP, sem alterar diretamente o core do Frappe nem do CRM.

Sugestao de namespace:

```text
univesp.api.session.get_context
univesp.api.ticket.create
univesp.api.ticket.list
univesp.api.ticket.get
univesp.api.ticket.add_comment
univesp.api.ticket.attach
univesp.api.ticket.assign
univesp.api.ticket.transition
univesp.api.admin.profile_map
```

Essa camada deve:

- traduzir a sessao SSO para usuario, perfil e escopo operacional
- validar permissao por perfil, fila, polo, area e ownership
- esconder detalhes internos do DocType usado
- devolver respostas estaveis para o frontend

## Perfis iniciais

Perfis reais previstos:

- `aluno`: usa SSO, abre e acompanha apenas seus proprios protocolos
- `op`: usa SSO, atende fila operacional, cria atendimento assistido e responde ao aluno
- `gestor_polo`: preferencialmente usa SSO; caso seja externo, pode exigir convite ou cadastro controlado
- `gestor_area`: usa SSO, acompanha filas e protocolos da sua area de responsabilidade
- `admin`: usa SSO, administra configuracoes, permissoes, auditoria e governanca

Granularidade recomendada:

- perfil base: aluno, op, gestor_polo, gestor_area, admin
- escopo: polo, area, fila, curso ou combinacao desses
- acoes: visualizar, criar, comentar, anexar, atribuir, mudar status, encerrar, editar FAQ, configurar permissoes

O frontend pode controlar menus, telas e atalhos por perfil. A permissao final deve ser reforcada no backend para evitar acesso indevido por chamada direta de API.

## DocType recomendado para atendimento

Recomendacao para MVP: usar `Issue`.

Motivos:

- ja faz parte do ecossistema padrao do Frappe/CRM
- reduz dependencia de outro app no inicio
- atende bem abertura, historico, status, comentarios e responsavel
- facilita evoluir sem travar o frontend

Usar `HD Ticket` somente se o app Helpdesk estiver instalado e se a UNIVESP quiser adotar de imediato recursos especificos de helpdesk, como SLA nativo, agent workspace e filas proprias do Helpdesk.

Campos customizados recomendados para `Issue`:

- `univesp_protocol`
- `univesp_source`
- `student_email`
- `student_name`
- `student_ra`
- `student_polo`
- `student_course`
- `queue`
- `area`
- `public_status`
- `priority`
- `sso_profile`
- `profile_scope`
- `source_bundle_id`
- `source_bundle_version_id`
- `source_node_id`

Se no futuro o `HD Ticket` for adotado, a API customizada deve proteger o frontend dessa troca. O Vue continuaria chamando os mesmos endpoints `univesp.api.ticket.*`.

## Dados vindos do SSO

Campos minimos confirmados para a primeira fase:

- email
- nome
- RA

Campos a enriquecer depois:

- polo
- curso
- vinculo ativo
- perfil institucional
- area ou fila operacional

Recomendacao:

1. confiar no SSO para identificar a pessoa
2. mapear perfil e escopo em tabelas controladas no Frappe
3. enriquecer polo e curso por base academica, API interna ou cache sincronizado

Um DocType auxiliar pode guardar snapshot dos dados academicos usados no atendimento, por exemplo `Univesp Student Snapshot`.

## Visibilidade e permissoes

Regra central:

- frontend mostra a experiencia correta para cada perfil
- backend decide se a acao e permitida

Exemplos:

- aluno ve apenas protocolos ligados ao proprio email/RA
- op ve filas liberadas para seu usuario/perfil
- gestor de polo ve dados do seu polo
- gestor de area ve casos da sua area
- admin ve tudo e altera configuracoes

Toda lista ou detalhe de protocolo deve aplicar filtro por ownership e escopo operacional no backend.

## Status oficiais sugeridos

Status canonicos internos:

- `open`
- `in_analysis`
- `waiting_student`
- `waiting_internal`
- `resolved`
- `closed`
- `cancelled`

Rotulos publicos:

- Aberto
- Em analise
- Aguardando aluno
- Em atendimento interno
- Resolvido
- Encerrado
- Cancelado

Transicoes iniciais:

- protocolo criado: `open`
- triagem iniciada pela OP: `in_analysis`
- pedido de complemento ao aluno: `waiting_student`
- escalado para area interna: `waiting_internal`
- resposta final enviada: `resolved`
- encerramento operacional: `closed`
- cancelamento por erro, duplicidade ou invalidade: `cancelled`

O `Issue.status` pode guardar o estado operacional do Frappe, enquanto `public_status` guarda a visao estavel apresentada ao aluno.

## Fases de API

### Fase 1: sessao e contexto

- `get_context`
- retorna usuario, perfil, escopos, permissoes e dados minimos do aluno
- habilita o frontend a renderizar aluno, OP, gestor ou admin

### Fase 2: protocolo do aluno

- `ticket.create`
- `ticket.list`
- `ticket.get`
- `ticket.add_comment`
- `ticket.attach`
- cobre abertura, historico, anexos e acompanhamento

### Fase 3: operacao

- `ticket.assign`
- `ticket.transition`
- filtros por fila, area, polo e status
- historico de mudanca e trilha de auditoria

### Fase 4: governanca

- configuracao de perfis e escopos
- matriz de permissoes
- dashboards e relatorios
- integracao com base academica

## Decisoes pendentes

- confirmar se `gestor_polo` externo ficara fora do SSO ou entrara por federacao/convite
- confirmar se o Helpdesk esta instalado e se ha motivo para escolher `HD Ticket` no lugar de `Issue`
- definir matriz final de acoes por perfil
- confirmar origem oficial de polo e curso
- definir formato oficial do numero de protocolo
- confirmar quais status aparecem para o aluno e quais ficam apenas internos

## Recomendacao resumida

Para homologacao real, seguir com `Issue` como DocType de atendimento, criar APIs customizadas `univesp.api.*`, usar SSO apenas para identidade inicial, enriquecer dados academicos depois, e tratar perfil/permissao como contrato de backend com reflexo visual no frontend.
