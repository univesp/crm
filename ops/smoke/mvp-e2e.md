# Smoke MVP — Trilha B (E2E)

Validacao minima do wiring Vue ↔ BFF ↔ Frappe **sem mock de negocio**.

## Pre-requisitos

1. Frappe bench no ar (`FRAPPE_ORIGIN`, site migrado).
2. BFF + frontend via `docker-compose.vm.yml` ou dev local.
3. `.env` / `.env.vm` com:
   - `VITE_ENABLE_MOCKS=false`
   - `VITE_SSO_DEV_BYPASS=true` (somente homolog interna)
4. Secrets BFF ↔ Frappe preenchidos (`UNIVESP_*_SECRET`, `FRAPPE_API_*`).

## 1. Health

```bash
curl -sf "$APP_BASE_URL/healthz"
curl -sf "$APP_BASE_URL/api/public/v1/knowledge/faq-published?faq_type=publico"
```

> `/api/app/v1/health` exige sessao; use `/healthz` para smoke automatico.

PowerShell: `.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br`

### Resultado homolog (2026-07-23)

| Check | Resultado |
|-------|-----------|
| `GET /healthz` | 200 |
| `GET /api/public/v1/knowledge/faq-published?faq_type=publico` | 200 (vazio, pre-import) |
| `GET /publico` | 200 |
| `GET /crm/` | 200 |
| `POST /api/public/v1/tickets` (sem LGPD) | 422 (rota ativa) |
| HD Teams | `atendimento-geral`, `sra` |
| Access profiles (dev bypass) | `admin@univesp.br`, `teste@aluno.univesp.br`, `op@polo.univesp.br`, `bpo.regional@externo.univesp.br` |

Reaplicar access profiles: `bench --site crm.localhost execute univesp_atendimento.homolog_seed_access_profiles.upsert_homolog_access_profiles` (modulo copiado em homolog; ver `ops/vm/scripts/homolog-seed-access-profiles.py`).

## 2. Dev bypass (homolog interna)

1. Abra `$APP_BASE_URL/crm/` com `VITE_SSO_DEV_BYPASS=true`.
2. Selecione perfil **Aluno** → `/aluno` carrega sem redirect SSO.
3. Repita com **OP** → `/op/fila` e **Operador externo (BPO)** → `/bpo/dashboard`.

## 3. FAQ → protocolo (aluno)

1. Perfil aluno: navegue FAQ publicada.
2. Abra atendimento a partir de no terminal (`abrir_atendimento`).
3. Confirme protocolo criado (`custom_univesp_source=portal`).
4. OP/BPO ve o ticket na fila conforme escopo de polo/fila.

## 4. Visitante publico

1. Abra `/publico` (sem login).
2. Registre visitante → FAQ publico → abra protocolo.
3. Confirme `custom_univesp_source=publico` no ticket.

## 5. BPO — escalacao interna

1. Perfil `op_externo` (dev bypass).
2. Abra ticket do pool regional.
3. `POST /api/app/v1/tickets/{id}/escalate` com `{ "message": "...", "destination_area": "Triagem Central" }`.
4. Status deve ir para `waiting_internal`.

## 6. Pos-SSO aluno (quando IdP disponivel)

```bash
curl -X POST "$APP_BASE_URL/api/app/v1/students/validate" \
  -H "Cookie: crm_session=..." \
  -H "Content-Type: application/json" \
  -d '{"cpf":"00000000000","email":"teste@aluno.univesp.br"}'
```

## Criterio de aceite Trilha B

- [ ] Health OK
- [ ] Dev bypass → aluno + OP + BPO sem mock
- [ ] FAQ aluno → protocolo → visivel na fila OP
- [ ] `/publico` → protocolo visitante
- [ ] Escalacao BPO → `waiting_internal`

Ver tambem `docs/MVP_CLOSURE_CHECKLIST.md`.
