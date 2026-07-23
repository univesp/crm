# ADR-001 — Frappe Helpdesk (nao Frappe CRM)

## Status

Aceito — 2026-07-23

## Contexto

O repositorio upstream inclui Frappe CRM (vendas/leads). O produto UNIVESP Atendimento precisa de protocolos, filas OP, FAQ e escalação — dominio de **Helpdesk**.

## Decisao

- Engine: **Frappe Framework + Frappe Helpdesk (`HD Ticket`)**
- App custom: **`univesp_atendimento_app`**
- Experiencia: **Vue 3 SPA + SSO Gateway BFF**
- **Nao** usar Frappe CRM como motor de tickets

## Consequencias

- Instalar Helpdesk + Telephony (commits fixados) na VM/Cloud Run
- Custom fields em `HD Ticket` para protocolo, polo, contexto FAQ
- CRM upstream permanece espelho; produto vive na branch/worktree UNIVESP
