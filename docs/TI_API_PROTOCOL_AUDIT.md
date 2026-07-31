# Especificacao TI — Protocolos e Auditoria (`univesp_atendimento.api.v1`)

Documento de alinhamento entre front-end CRM UNIVESP e back-end Frappe/Gateway para as telas **Admin > Protocolos** e **Admin > Auditoria**.

Status: proposta para homologacao integrada.  
Base de consumo no front: `univesp-frontend/src/services/appApi.js`.

## Contexto

O front-end ja consome:

- `GET /tickets` — listagem paginada basica (`page`, `page_size`)
- `GET /tickets/{id}` — detalhe por protocolo/ID exato (busca global no cabecalho)

As novas telas precisam de filtros combinados e auditoria paginada no servidor. Enquanto os parametros abaixo nao existirem na API, o simulador/mock aplica filtros locais sobre o lote retornado.

## 1. Listagem de protocolos

**Endpoint existente:** `GET /api/app/v1/tickets`

### Parametros adicionais solicitados

| Parametro | Tipo | Obrigatorio | Descricao |
|-----------|------|-------------|-----------|
| `page` | int | sim | Pagina (1-based) |
| `page_size` | int | sim | Tamanho da pagina (padrao 25, max 100) |
| `protocol` | string | nao | Numero exato ou parcial do protocolo |
| `student` | string | nao | Nome, RA ou e-mail do aluno |
| `polo` | string | nao | Polo do aluno |
| `theme` | string | nao | Tema/assunto normalizado |
| `queue` | string | nao | Fila atual ou destino |
| `criticality` | string | nao | Criticidade/prioridade |
| `status` | string | nao | Status operacional |
| `date_from` | ISO date | nao | Inicio do periodo (updated_at) |
| `date_to` | ISO date | nao | Fim do periodo (updated_at) |

### Resposta esperada

```json
{
  "data": [
    {
      "id": "PRT-2026-000145",
      "protocol": "PRT-2026-000145",
      "subject": "Envio de atestado medico",
      "status": "waiting_internal",
      "status_label": "Aguardando area interna",
      "priority": "high",
      "priority_label": "Alta",
      "queue": "Secretaria Academica",
      "area": "SRA",
      "theme": "provas",
      "created_at": "2026-07-20T10:15:00Z",
      "updated_at": "2026-07-21T08:42:00Z",
      "student": {
        "name": "Maria Silva",
        "ra": "2026001234",
        "email": "maria@example.com",
        "polo": "Polo Campinas"
      },
      "timeline": []
    }
  ],
  "meta": {
    "total": 1284,
    "page": 1,
    "page_size": 25,
    "request_id": "..."
  }
}
```

### Regras de negocio

- Filtros devem ser combinaveis (AND).
- Escopo por perfil continua sendo aplicado no back-end (OP/gestor/admin).
- `meta.total` deve refletir o total filtrado, nao apenas o lote da pagina.

## 2. Detalhe de protocolo

**Endpoint existente:** `GET /api/app/v1/tickets/{ticket_id}`

### Campos adicionais desejados no payload

| Campo | Descricao |
|-------|-----------|
| `timeline[]` | Historico auditavel do protocolo (`id`, `actor`, `message`, `created_at`) |
| `theme` / `subtheme` | Vocabulario controlado alinhado a FAQ e SLA |
| `sla_label` | SLA calculado para exibicao |
| `assignee` / `assignee_email` | Responsavel atual |

## 3. Auditoria operacional de tickets

**Endpoint novo:** `GET /api/app/v1/admin/ticket-audit`

### Parametros

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `page`, `page_size` | int | Paginacao |
| `q` | string | Busca livre (protocolo, aluno, assunto, ator) |
| `protocol` | string | Protocolo exato |
| `student` | string | Aluno |
| `polo` | string | Polo |
| `theme` | string | Tema |
| `queue` | string | Fila |
| `action_type` | string | Tipo de acao (`reply`, `escalate`, `request_info`, ...) |
| `actor` | string | Usuario/ator |
| `date_from`, `date_to` | ISO date | Periodo da movimentacao |

### Resposta esperada

```json
{
  "data": [
    {
      "id": "aud-001",
      "protocol": "PRT-2026-000145",
      "subject": "Envio de atestado medico",
      "action_type": "escalate",
      "action_label": "Escalonado para area interna",
      "actor": "OP Polo Campinas",
      "occurred_at": "2026-07-21T08:42:00Z",
      "occurred_at_label": "21/07/2026 08:42",
      "status_before": "Em analise",
      "status_after": "Aguardando area interna",
      "queue_before": "Operacao do Polo",
      "queue_after": "Secretaria Academica",
      "student_name": "Maria Silva",
      "polo": "Polo Campinas",
      "theme": "provas",
      "criticality": "Alta",
      "note": "Encaminhado por prazo de prova"
    }
  ],
  "meta": {
    "total": 9321,
    "page": 1,
    "page_size": 25
  }
}
```

### Permissao

- Perfil `admin_central` com acao `view_ticket` (ou acao dedicada `view_audit` se preferirem separar auditoria operacional de auditoria de acesso).

## 4. Vocabulario tema/subtema (FAQ + SLA)

Para o bloco **Prazo/regra vigente** da FAQ referenciar regras sem duplicacao:

- Usar as mesmas chaves normalizadas de `theme` / `subtheme` em:
  - nos finais da FAQ (`tema` / `subtema`)
  - regras de `AdminParametersPage` (`targetType=theme|subtheme`, `targetValue`)
  - payload de tickets/auditoria

Sugestao: catalogo central em `GET /admin/catalogs` ou `GET /admin/runtime-settings`.

## 5. Prioridade de entrega sugerida

1. Paginacao real + `meta.total` em `GET /tickets` (ja parcialmente usado).
2. Filtros `protocol`, `student`, `polo`, `date_from`, `date_to`.
3. Endpoint `GET /admin/ticket-audit` paginado.
4. Filtros restantes (`theme`, `queue`, `criticality`, `status`, `action_type`).

## 6. Compatibilidade com simulador

Com `VITE_ENABLE_MOCKS=true`, o front-end continua operacional usando:

- dados mock de dashboard/fila para listagens locais
- seeds de auditoria em `mocks/operations`

Nenhuma regressao e esperada quando a API passar a honrar os parametros acima.
