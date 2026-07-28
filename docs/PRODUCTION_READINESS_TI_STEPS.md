# Plano de prontidao para homologacao real e producao

Este documento separa o que ja pode ser preparado no frontend do que depende do time de TI/Frappe/infraestrutura.

## Estado atual

O frontend ja possui:

- rotas por perfil;
- shell institucional;
- controles de acessibilidade;
- cliente Frappe por sessao/cookie;
- desenho de SSO via `/api/me` e `/api/sso/*`;
- fluxos de aluno, OP, area, gestor e admin;
- base mockada suficiente para homologacao visual e funcional assistida.

Ainda nao esta pronto para producao plena porque a verdade operacional precisa sair do frontend e passar para o Frappe/backend.

## O que o frontend pode manter local

Podem continuar no navegador:

- tema claro/escuro;
- zoom/fonte legivel/alto contraste;
- filtros temporarios de tela;
- estado temporario de UI;
- recuperacao de chunk/reload;
- modo de acesso local apenas em desenvolvimento/homologacao controlada.

Nao devem ficar no navegador como fonte oficial:

- protocolo;
- fila;
- historico de atendimento;
- permissao efetiva;
- publicacao de FAQ;
- auditoria;
- ownership/assignment;
- SLA/criticidade;
- dados pessoais do aluno alem do necessario para sessao exibida.

## Ordem recomendada para TI

### 1. Definir dominio e HTTPS

Responsavel: TI/infra.

Entregas:

- dominio final de homologacao e producao;
- certificado valido;
- redirecionamento HTTP para HTTPS;
- decisao de rota publica do frontend (`/` ou `/crm`);
- separacao clara entre frontend, gateway SSO e Frappe.

Critério de pronto:

- `https://...` abre sem erro de certificado;
- rotas internas recarregam sem 404;
- assets estaticos carregam por HTTPS.

### 2. Implementar gateway SSO

Responsavel: TI/identidade.

Endpoints minimos:

- `GET /api/me`;
- `GET /api/sso/start?email=&next=`;
- `GET /api/sso/azure/start?tenant=&next=`;
- `GET /api/sso/saml/start?next=`;
- `POST /api/sso/logout`.

Requisitos:

- callbacks SAML/Azure terminam no gateway, nao no frontend;
- validar `issuer`, `audience`, assinatura, `state`, `nonce` e expiracao;
- validar `next` somente para rotas internas;
- bloquear open redirect;
- criar sessao segura;
- retornar perfil normalizado em `/api/me`.

Contrato minimo de `/api/me`:

```json
{
  "id": "usuario-institucional",
  "email": "usuario@univesp.br",
  "displayName": "Nome do Usuario",
  "flow": "aluno|academico|admin",
  "profileKey": "aluno|op|gestor_polos|analista_area|gestor_area|admin_central",
  "roles": ["..."],
  "groups": ["..."],
  "polo": "Guarulhos",
  "linkedPolos": ["Guarulhos"],
  "area": "Secretaria Academica",
  "linkedAreas": ["Secretaria Academica"],
  "expiresAt": "2026-06-19T18:00:00-03:00"
}
```

Critério de pronto:

- sem sessao retorna `401` ou `204`;
- sessao valida retorna usuario normalizado;
- logout remove sessao;
- cookie usa `HttpOnly`, `Secure` e `SameSite` adequado.

### 3. Definir modelo Frappe

Responsavel: TI/Frappe + produto.

Decidir se o caso oficial sera:

- `Issue`;
- `HD Ticket`;
- DocType customizado.

DocTypes ou entidades obrigatorias:

- caso/protocolo;
- evento/auditoria;
- comentario/resposta;
- anexo;
- FAQ bundle;
- FAQ versao;
- FAQ node;
- FAQ link;
- publicacao de FAQ;
- sugestao de melhoria;
- assignment/ownership;
- fila/area/polo;
- SLA e criticidade;
- perfil/permissao/escopo;
- disponibilidade/elegibilidade operacional.

Critério de pronto:

- cada entidade critica tem dono, campos obrigatorios e permissao;
- existe trilha append-only para auditoria;
- casos ativos guardam snapshot da versao de conhecimento usada.

### 4. Criar endpoints de negocio

Responsavel: TI/Frappe.

Endpoints minimos para sair do mock:

#### Aluno

- `POST /api/resource/Issue` ou endpoint custom para abrir protocolo;
- `GET /api/method/univesp.api.student.list_protocols`;
- `GET /api/method/univesp.api.student.get_protocol`;
- `POST /api/method/univesp.api.student.append_message`;
- `POST /api/method/univesp.api.student.attach_file`.

#### OP

- `GET /api/method/univesp.api.operator.queue`;
- `GET /api/method/univesp.api.operator.case_detail`;
- `POST /api/method/univesp.api.operator.reply`;
- `POST /api/method/univesp.api.operator.request_student_complement`;
- `POST /api/method/univesp.api.operator.escalate_to_area`;
- `POST /api/method/univesp.api.operator.open_on_behalf`.

#### Area

- `GET /api/method/univesp.api.area.queue`;
- `GET /api/method/univesp.api.area.case_detail`;
- `POST /api/method/univesp.api.area.reply`;
- `POST /api/method/univesp.api.area.request_complement`;
- `POST /api/method/univesp.api.area.reassign`;
- `POST /api/method/univesp.api.area.suggest_knowledge_update`.

#### Admin

- `GET /api/method/univesp.api.admin.dashboard`;
- `GET /api/method/univesp.api.admin.faq.list`;
- `GET /api/method/univesp.api.admin.faq.get`;
- `POST /api/method/univesp.api.admin.faq.dry_run`;
- `POST /api/method/univesp.api.admin.faq.save_draft`;
- `POST /api/method/univesp.api.admin.faq.submit_review`;
- `POST /api/method/univesp.api.admin.faq.publish`;
- `POST /api/method/univesp.api.admin.permissions.update`;
- `POST /api/method/univesp.api.admin.parameters.update`.

Critério de pronto:

- endpoints retornam erro estruturado;
- todas as mutacoes validam permissao no servidor;
- todos os eventos criticos geram auditoria;
- filtros de fila rodam no backend.

### 5. Banco, indices e concorrencia

Responsavel: TI/Frappe/DBA.

Indices minimos para fila:

- status;
- responsavel atual;
- polo;
- area;
- fila;
- SLA;
- criticidade;
- assunto/subassunto;
- data de abertura;
- data de ultima movimentacao.

Concorrencia:

- assignment deve ser atomico;
- duas pessoas nao podem assumir/responder o mesmo estado sem verificacao de versao;
- publicacao de FAQ deve ser transacional;
- alteracao de SLA/permissao deve registrar versao e auditoria.

Critério de pronto:

- teste com volume representativo;
- paginacao server-side;
- busca indexada;
- lock otimista ou mecanismo equivalente para mutacoes concorrentes.

### 6. Seguranca

Responsavel: TI/seguranca.

Obrigatorio:

- nenhum segredo em `VITE_*`;
- secrets no Secret Manager;
- CSRF para metodos mutaveis;
- CORS restrito;
- cookies `HttpOnly`, `Secure`, `SameSite`;
- rate limit em login e abertura de protocolo;
- sanitizacao server-side de HTML da FAQ;
- validacao de upload: tipo, tamanho, antivirus quando aplicavel;
- logs sem dados sensiveis desnecessarios;
- politica LGPD para retencao e acesso.

Critério de pronto:

- teste de permissao horizontal: OP nao ve caso de outro polo;
- teste de permissao vertical: aluno nao acessa admin/API operacional;
- teste de XSS em campos de FAQ/resposta;
- teste de open redirect no `next`;
- teste de expiracao de sessao.

### 7. Observabilidade e operacao

Responsavel: TI/SRE.

Obrigatorio:

- health check do frontend;
- health check do gateway;
- health check do Frappe;
- logs estruturados;
- correlacao por protocolo/request id;
- alerta de erro 5xx;
- alerta de fila com SLA vencido;
- dashboard de latencia e volume;
- backup e restore testados.

Critério de pronto:

- incidente simulado consegue ser rastreado do frontend ao Frappe;
- rollback documentado;
- restore de backup validado em ambiente nao produtivo.

### 8. Homologacao controlada

Responsavel: produto + TI + operacao.

Roteiro:

1. selecionar poucos polos;
2. selecionar uma ou duas areas responsaveis;
3. importar FAQ inicial;
4. testar aluno real ou massa controlada;
5. testar OP real;
6. testar analista/gestor de area;
7. testar admin publicando uma mudanca;
8. medir volume, erro, tempo de resposta e escalonamento.

Critério de pronto:

- nenhum fluxo critico depende de mock;
- aluno recebe protocolo real;
- OP ve fila real;
- area responde caso real;
- admin publica FAQ real com auditoria;
- logs e permissao foram validados.

## Sequencia de entrega sugerida

1. SSO `/api/me` funcionando.
2. Criacao e listagem de protocolo do aluno.
3. Fila OP com paginacao backend.
4. Detalhe do caso e resposta OP.
5. Escalonamento para area.
6. Fila area e resposta final.
7. Auditoria de eventos.
8. FAQ publicada pelo admin consumida pelo aluno/OP.
9. Permissoes server-side.
10. Piloto restrito.

## Go/no-go

Nao ir para producao se qualquer item abaixo estiver aberto:

- `/api/me` sem contrato fechado;
- permissao validada apenas no frontend;
- fila filtrada apenas no browser;
- protocolo salvo apenas em `localStorage`;
- editor FAQ aceitando HTML sem sanitizacao server-side;
- ausencia de auditoria em publicacao/resposta/escalonamento;
- falta de HTTPS valido;
- falta de backup/restore;
- `lint`, `typecheck` ou `build` falhando no pipeline.
