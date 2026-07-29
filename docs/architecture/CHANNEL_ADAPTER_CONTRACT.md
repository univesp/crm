# Contrato de payload omnichannel (Fase C)

> **Status:** implementado em `univesp_atendimento.channel_adapter.normalize_channel_payload` e integrado em `POST /api/v1/tickets` quando o payload inclui `channel` (retrocompativel sem a chave).

Todo adapter (WhatsApp, e-mail, telefone, portal) normaliza para este shape antes do BFF/Frappe.

```json
{
  "channel": "whatsapp|email|phone|portal|publico",
  "source": "portal",
  "student": {
    "ra": "1000005",
    "email": "aluno@aluno.univesp.br",
    "name": "Maria Silva",
    "polo": "237",
    "course": "Lic. Computacao"
  },
  "subject": "Assunto",
  "description": "Texto livre",
  "attachments": [],
  "faq_context": {
    "bundle_id": "acesso-ava",
    "path": ["root", "node-final"],
    "resolved": false
  },
  "channel_metadata": {
    "external_message_id": "wamid.xxx",
    "phone": "+5511999999999",
    "recording_url": "gs://bucket/recording.ogg"
  },
  "queue": "atendimento-geral",
  "area": ""
}
```

## Campos HD Ticket

| Campo | Uso |
|-------|-----|
| `custom_univesp_source` | `portal`, `publico`, ou nome do canal |
| `custom_channel_metadata_json` | Metadados do canal (JSON) |
| `custom_ai_suggestion_json` | Sugestao IA assincrona (Fase D) |
| `custom_source_bundle_id` / `custom_source_node_id` | Mapeados de `faq_context` |

## Endpoint BFF

Adapters externos devem chamar o mesmo `POST /api/app/v1/tickets` (autenticado) ou rotas publicas quando visitante.

Webhooks email/WhatsApp (sem sessao): `POST /api/ingress/v1/tickets` com cabecalho `X-Univesp-Ingress-Secret` (`UNIVESP_INGRESS_SHARED_SECRET`). Gateway repassa para `ingress.create_ticket` no Frappe.

## Erros (422)

Resposta envelope padrao Frappe/BFF quando validacao falha:

```json
{
  "data": null,
  "error": {
    "code": "ValidationError",
    "message": "Canal invalido: telegram.",
    "user_message": "Canal invalido: telegram."
  },
  "meta": {},
  "request_id": "..."
}
```

Exemplos de mensagens: `Campo channel obrigatorio.`, `Assunto obrigatorio.`, `Campo student deve ser um objeto.`, `faq_context.path deve ser uma lista.`
