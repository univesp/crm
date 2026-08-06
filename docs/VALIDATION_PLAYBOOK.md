# Playbook de Validação - CRM UNIVESP

## Objetivo
Validar exatamente o que mudou, com evidência suficiente e sem custo operacional desnecessário.

## Níveis de Validação
- Nível 1 (documental): alterações apenas em docs/rules/skills.
- Nível 2 (focal): pequena alteração funcional local.
- Nível 3 (amplo): mudança com risco moderado/alto ou impacto transversal.

## Evidência Mínima Obrigatória
- `git diff --stat`
- `git status --short`
- Justificativa breve do nível de validação aplicado

## Quando a Mudança é Só de Docs/Rules/Skills
- Não rodar build/test/lint global, salvo solicitação explícita.
- Confirmar ausência de alterações em `.vue`, serviços, rotas, auth e build/deploy.

## Quando Houver Mudança Funcional (futuro)
- Executar primeiro o menor teste/checagem relevante.
- Expandir validação apenas se risco real justificar.
- Registrar comportamento observado e risco residual.

## Critério de Segurança para Entrega
- Mudança pequena e revisável.
- Sem efeito colateral não solicitado.
- Caminho de rollback simples.

## Smoke MVP (Trilhas B, D e E)

- **Trilha B (E2E):** `ops/smoke/mvp-e2e.md` + `.\ops\smoke\mvp-e2e.ps1 -BaseUrl <url>`
- **PWA / Ingress (opcional):** `.\ops\smoke\mvp-e2e.ps1 -BaseUrl <url> -IncludePwa -IncludeIngress`
- **Playwright wiring:** `cd univesp-frontend && npm run test:e2e -- e2e/mvp-wiring.spec.js`
- Import Trino piloto: `python ops/import/students-from-trino.py --validate-env` then `--dry-run --limit 10`
- Pós-SSO: `POST /api/app/v1/students/validate` com CPF/email de teste
- Visitante: `/publico` → registro → FAQ → protocolo (`custom_univesp_source=publico`)
- VM interim: `ops/vm/bootstrap.sh` + `curl /healthz`
- **Deploy VM homolog:** `docs/ops/DEPLOY_VM_HOMOLOG.md` + smoke pos-deploy
- GCS site_config: `ops/vm/scripts/validate-gcs-site-config.sh`
- Cloud Run artefatos locais: `ops/cloudrun/preflight-local.sh`
- Checklist completo: `docs/MVP_CLOSURE_CHECKLIST.md`
