# FAQ pública — configuração de e-mail

O workflow de homolog configura essas chaves no `site_config.json` a partir de
variáveis não sensíveis e segredos do GitHub/Secret Manager. Não grave senhas no
repositório.

Variáveis do ambiente `homolog`:

| Nome | Exemplo |
|---|---|
| `PUBLIC_REPLY_DOMAIN` | `atendimento.univesp.br` |
| `SMTP_HOST` | host SMTP institucional |
| `SMTP_PORT` | `587` |
| `SMTP_USERNAME` | conta técnica SMTP |
| `SMTP_FROM_EMAIL` | remetente institucional |
| `SMTP_FROM_NAME` | `Atendimento UNIVESP` |
| `SMTP_USE_TLS` | `true` |
| `SMTP_USE_SSL` | `false` |
| `SMTP_NO_AUTHENTICATION` | `false`; use `true` somente para relay institucional confiável |

No modo autenticado, configure:

- `SMTP_USERNAME`;
- segredo `SMTP_PASSWORD`.

No modo relay institucional (`SMTP_NO_AUTHENTICATION=true`), usuário e senha não
são usados. O workflow mantém um segredo opaco apenas para preservar o contrato
de montagem entre revisões, mas o site configura `no_smtp_authentication=true`.

O workflow cria automaticamente, no Secret Manager, os segredos aleatórios
`crm-homolog-public-email-reply-secret` e
`crm-homolog-ingress-shared-secret`. O segundo é montado tanto no gateway quanto
na configuração do site Frappe.

O bootstrap falha antes de ativar `faq_public_email_thread` se a configuração
estiver incompleta. No modo autenticado, executa `EHLO`, TLS/SSL, login e `NOOP`.
No modo relay, executa `EHLO`, TLS/SSL, valida `MAIL FROM`, aplica `RSET` e
`NOOP`. Nenhum dos dois modos envia mensagem durante o gate.

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
