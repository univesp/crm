# FAQ pública — configuração de e-mail

Chaves no `site_config.json`:

```json
{
  "public_reply_domain": "atendimento.univesp.br",
  "public_email_reply_secret": "SECRET_MANAGER_REFERENCE",
  "univesp_ingress_shared_secret": "SECRET_MANAGER_REFERENCE"
}
```

O Frappe envia a confirmação com `Reply-To` no formato
`reply+TICKET.TOKEN@dominio`. O provedor de e-mail encaminha a mensagem normalizada
para `POST /api/ingress/v1/email-replies`, autenticado por
`X-Univesp-Ingress-Secret`.

Campos mínimos: `message_id`, `sender`, `recipient`, `subject` e `text`. Anexos usam
`filename`, `content_type` e `content_base64`; passam pelo mesmo scanner da FAQ
pública. `message_id` repetido é tratado como retry idempotente e não cria nova
`Communication`.

Rotacione `public_email_reply_secret` somente com janela controlada: tokens de
mensagens já enviadas deixam de ser válidos após a troca.
