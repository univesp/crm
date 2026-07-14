# API publica do Atendimento UNIVESP

Versao inicial: `v1`. Todas as rotas sao same-origin e exigem a sessao do SSO.

## Envelope

```json
{
  "data": {},
  "error": null,
  "meta": {},
  "request_id": "uuid"
}
```

Erros usam `error.code`, `error.message` para logs e `error.user_message` para
a interface. Paginacao usa `meta.page`, `meta.page_size` e `meta.total`.

## Identidade

`GET /api/me` retorna `email`, `name`, `ra`, `profile`, `scopes`, `actions` e
`expires_at`. Perfil ausente resulta em `403 PROFILE_NOT_ASSIGNED`; nunca existe
fallback pelo dominio do e-mail.

## Tickets

- `POST /api/app/v1/tickets`
- `GET /api/app/v1/tickets`
- `GET /api/app/v1/tickets/:id`
- `POST /api/app/v1/tickets/:id/messages`
- `POST /api/app/v1/tickets/:id/attachments`
- `POST /api/app/v1/tickets/:id/assign`
- `POST /api/app/v1/tickets/:id/transition`

O servidor aplica escopo por identidade: aluno ve o proprio e-mail; OP ve as
filas autorizadas; gestores veem polos ou areas autorizados; administrador tem
escopo global explicito. Filtros enviados pelo cliente apenas restringem o
resultado e nunca ampliam o escopo.

## Referencias

- `GET /api/app/v1/queues`
- `GET /api/app/v1/knowledge/published`

Anexos sao privados. A resposta da API fornece um identificador para download
autorizado pelo BFF, nunca uma URL publica do Frappe.
