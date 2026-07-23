# Contrato de payload omnichannel (Fase C)

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
| `custom_univesp_source` | `portal`, `publico`, futuro canal |
| `custom_channel_metadata_json` | Metadados do canal (JSON) |
| `custom_ai_suggestion_json` | Sugestao IA assincrona (Fase D) |

## Endpoint BFF

Adapters externos devem chamar o mesmo `POST /api/app/v1/tickets` (autenticado) ou rotas publicas quando visitante.

Implementacao completa: Fase C — ver plano secao 4.
