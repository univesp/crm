# Checklist fechamento MVP (Fase A)

Status em **2026-07-23** após wave 1 + wave 2 (código).

## Auth e sessão

- [ ] SSO Azure/SAML em homolog/prod (IdP TI)
- [ ] BFF entrega sessão estável (`fetchCurrentSsoUser`)
- [x] `VITE_ENABLE_MOCKS=false` documentado em `env.vm.example` e `.env.development.example`
- [x] Dev bypass homolog (`VITE_SSO_DEV_BYPASS`) — perfis incluem `op_externo`
- [ ] CSRF/cookies end-to-end no domínio institucional

## FAQ e conhecimento

- [x] Seeds JSON: `docs/seeds/faq-{aluno,op,publico}-seed.json`
- [x] Filas HD Team homolog: `atendimento-geral`, `sra` (tickets recebem `agent_group`)
- [x] Catalogo frontend inclui `atendimento-geral` (`faqCatalogs.js`) — redeploy frontend antes do import
- [ ] Bundles publicados no Admin (você)
- [ ] Aluno consome FAQ real do Frappe

## Tickets e operação

- [x] API tickets + anexos + transições (Vue ↔ BFF ↔ Frappe)
- [x] Perfil `op_externo` + escopo `regional_pools`
- [x] `POST /tickets/:id/escalate` (BPO → `waiting_internal`)
- [x] Smoke E2E estrutural em homolog (health + FAQ publico vazia) — `ops/smoke/mvp-e2e.ps1`
- [ ] Smoke E2E fluxos UI secoes 2–5 (`ops/smoke/mvp-e2e.md`)

## Cadastro aluno (Trilha D)

- [x] DocType + `POST /students/validate`
- [x] Script Trino `--dry-run` / `--apply`
- [ ] `bench migrate` + piloto Trino com credenciais

## Público (Trilha E)

- [x] Rota `/publico` + API `/api/public/v1/*`
- [ ] Teste visitante em homolog

## Infra (Trilha A/F)

- [x] `docker-compose.vm.yml` + `ops/vm/bootstrap.sh`
- [x] Deploy VM homolog (`/var/crm`, site `crm.localhost`, migrate OK)
- [ ] `.env.vm` completo (Trino, GCS, IdP)
- [ ] Bucket GCS + `site_config` Frappe (TI)

## Critério de aceite

Demo aluno + OP + admin **sem mock de negócio**, com smoke `ops/smoke/mvp-e2e.ps1` + checklist seções 2–5.
