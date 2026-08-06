# Checklist fechamento MVP (Fase A)

Status em **2026-07-23** após wave 3 (PWA, ingress, stubs, TI prep).

## Auth e sessão

- [ ] SSO Azure/SAML em homolog/prod (IdP TI)
- [ ] BFF entrega sessão estável (`fetchCurrentSsoUser`)
- [x] `VITE_ENABLE_MOCKS=false` documentado em `env.vm.example` e `.env.development.example`
- [x] Dev bypass homolog (`VITE_SSO_DEV_BYPASS`) — perfis incluem `op_externo`
- [x] Access profiles homolog (bench): `admin@univesp.br`, `teste@aluno.univesp.br`, `op@polo.univesp.br`, `bpo.regional@externo.univesp.br` — escopos alinhados ao `mockAccessProfiles.js`
- [ ] CSRF/cookies end-to-end no domínio institucional

## FAQ e conhecimento

- [x] Seeds JSON: `docs/seeds/faq-{aluno,op,publico}-seed.json`
- [x] Filas HD Team homolog: `atendimento-geral`, `sra` (tickets recebem `agent_group`)
- [x] Catalogo frontend inclui `atendimento-geral` (`faqCatalogs.js`) — redeploy frontend antes do import
- [ ] Bundles publicados no Admin (você)
- [x] Merge fork UI `feature/admin-faq-governanca-polo` no PR #21
- [x] Dev bypass homolog build (`VITE_SSO_DEV_BYPASS=true`, `VITE_ENABLE_MOCKS=false` em `.env.production`)
- [ ] Aluno consome FAQ real do Frappe

## Tickets e operação

- [x] API tickets + anexos + transições (Vue ↔ BFF ↔ Frappe)
- [x] Perfil `op_externo` + escopo `regional_pools`
- [x] `POST /tickets/:id/escalate` (BPO → `waiting_internal`)
- [x] Omnichannel adapter (`channel_adapter.py` + `channel` key em `tickets.create`)
- [x] Ingress webhook `POST /api/ingress/v1/tickets` + `channel_ingress.py` + `UNIVESP_INGRESS_SHARED_SECRET`
- [x] Stub IA pos-criacao com job curto (`enqueue_ai_suggestion` → `complete_ai_suggestion_stub`)
- [x] `GET /students/:ra/academic-summary` (stub HOMOLOG* via `academic_query.py`)
- [x] `academicQueryPort.js` wired ao BFF
- [x] Smoke E2E estrutural em homolog — `ops/smoke/mvp-e2e.ps1` (+ flags `-IncludeIngress` `-IncludePwa`)
- [x] Playwright `e2e/mvp-wiring.spec.js` (dev bypass + FAQ publica)
- [x] Backend pos-FAQ: HD Teams `atendimento-geral`/`sra`; rotas `/publico`, `/crm/`, `/api/public/v1/*` respondem; `POST /api/public/v1/tickets` valida payload (422 sem LGPD)
- [ ] Smoke E2E fluxos UI secoes 2–5 (`ops/smoke/mvp-e2e.md`) — depende FAQ import + fork UI

## PWA (Fase B)

- [x] `vite-plugin-pwa` em `univesp-frontend` — manifest + SW (assets estaticos, sem cache de API)
- [x] Documentado em `ops/smoke/mvp-e2e.ps1 -IncludePwa`

## Cadastro aluno (Trilha D)

- [x] DocType + `POST /students/validate`
- [x] Script Trino `--dry-run` / `--apply` / `--validate-env` (`ops/import/students-from-trino.py`)
- [x] Handoff TI: `ops/import/README.md` + `.env.trino.example`
- [x] Seed homolog sintetico (`homolog_seed.upsert_homolog_student_directory` — 3 alunos HOMOLOG*, sem PII real)
- [x] `bench migrate` homolog VM (site `crm.localhost`)
- [x] Piloto Trino homolog VM (2026-08-06): cofre `crm-homolog-trino-crm-import`, ~273 alunos SEI importados
- [x] Apply em lotes via `import_students.upsert_rows_from_file` (evita limite argv)
- [ ] Import SEI completo filtro **AT** (~89k)
- [ ] Import OPs (`staff-from-trino.py`)

## Público (Trilha E)

- [x] Rota `/publico` + API `/api/public/v1/*`
- [x] Rota `/publico` responde em homolog (2026-07-23); fluxo visitante → protocolo apos FAQ import

## Infra (Trilha A/F)

- [x] `docker-compose.vm.yml` + `ops/vm/bootstrap.sh`
- [x] Deploy VM homolog (`/var/crm`, site `crm.localhost`, migrate OK)
- [x] Runbook deploy VM: `docs/ops/DEPLOY_VM_HOMOLOG.md` + status `docs/ops/HOMOLOG_VM_STATUS.md`
- [x] Branch deploy VM: `fix/bootstrap-homolog-unblock` (nao simulator foundation)
- [x] `ops/vm/scripts/install-atendimento-backend.sh` (rsync + migrate + seeds; git `safe.directory` para telephony)
- [x] Seeds bench: `univesp_atendimento.homolog_seed.upsert_homolog_access_profiles` (`admin_central` exige `areas`)
- [x] GCS prep: `docs/ops/gcs-frappe-site-config.example.md` + `validate-gcs-site-config.sh` + `gcs_config.py`
- [x] TI retorno infra + cofre: `docs/RETORNO_TI_EQUIPE_CRM.md`, `docs/ops/COFRE_SECRETS_CRM.md`
- [x] Cloud Run local readiness: `ops/cloudrun/preflight-local.sh`
- [x] `.env.trino` montado na VM (Secret Manager)
- [ ] Par HMAC GCS homolog (TI) + `site_config` upload
- [ ] Cutover prod Cloud SQL: `docs/ops/CUTOVER_PROD_MYSQL.md`
- [ ] Cloud Run deploy (TI — IAM GCP) — pipeline separado da VM

## Critério de aceite

Demo aluno + OP + admin **sem mock de negócio**, com smoke `ops/smoke/mvp-e2e.ps1` + checklist seções 2–5.
