# Status homolog VM — handoff operacional

**Atualizado:** 2026-08-06 (noite) — plano faseado de recuperação incorporado
**Branch alvo:** `fix/bootstrap-homolog-unblock` @ `325f8a66` (publicado e validado na VM)
**Alterações locais pendentes (preservar):** `HOMOLOG_VM_STATUS.md`, nginx `/files/` alias, `homolog_seed.py`, `.tmp-artifacts/`
**Ambiente:** `https://homolog-crm.univesp.br` na VM `crm-vm` (GCP `univesp-201808`, IAP SSH)  
**Para agentes:** leia junto com `docs/ops/DEPLOY_VM_HOMOLOG.md`, `docs/RETORNO_TI_EQUIPE_CRM.md`, `docs/ops/COFRE_SECRETS_CRM.md`, `docs/FAQ_V3_INTEGRATED_PILOT.md`

---

## Fase atual

**Homolog VM — fluxo admin FAQ v3 e Fase 1 de permissões validados; próximo passo: higiene/auditoria de runtime.**

Prod (`crm.univesp.br`) compartilha a mesma VM/Frappe/MariaDB até cutover Cloud SQL (`docs/ops/CUTOVER_PROD_MYSQL.md`).

### Matriz de validação (2026-08-06)

| Frente | Estado | Evidência |
|--------|--------|-----------|
| VM, gateway, nginx | **Validado** | healthz, proxy API, `/files/` alias |
| Bootstrap e flags FAQ v3 | **Validado** | `inspect_faq_v3_pilot`, draft/publish/versions 200 |
| Upload de imagem | **Validado** | File + disco + antimalware |
| Imagem no simulador | **Validado** | DevTools, bloco `<img>` |
| Persistência após reload | **Validado** | conteúdo mantido |
| Publicação admin (`teste 2`) | **Validado** | status Publicado, versão publicada, sem rascunho pendente |
| Mídia HTTP pública | **Validado** | nginx alias → 200 `image/png` |
| FAQ runtime aluno (`bbbbbbbbb`) | **Publicado** | `audience_profile: student` |
| FAQ runtime público anônimo | **Pendente** | validar `/publico` + bundle `public`/`mixed` |
| **`access-groups`** | **Validado após patch** | diagnóstico interno `ok: true`; grupo carregado na tela admin |
| **`permission-profiles`** | **Validado após patch** | perfis e usuários reais carregados em `/admin/permissoes` |
| Usuários / personas / seeds | **Auditoria inicial** | imports mock/hardcode identificados; OP Trino recuperado localmente |
| Jornadas por persona | **Não validado** | após grupos + perfis |

**Fluxo considerado concluído:**

> editar → subir imagem → salvar → publicar → recarregar

**Não fazer novos patches de mídia** salvo regressão comprovada.

### Ajustes confirmados no plano de recuperação

| Item | Estado |
|------|--------|
| `VITE_ENABLE_MOCKS=false` | Documentado, mas **imports diretos** de `mocks/` persistem — flag sozinha não garante operação real |
| `.env.production` | Patch local aplicado: `VITE_HOMOLOG_PROFILE_PREVIEW=false` | frontend ainda aguarda deploy separado |
| `staff-from-trino.py` | Recuperado seletivamente do commit `0d30be08`; DocType e upsert adicionados localmente |
| Escopo desta rodada | Planejamento + patches mínimos; sem merge `main`, cutover prod, carga massiva |

---

## Plano faseado de recuperação (Fases 0–5)

### Fase 0 — Baseline e matriz de APIs

Fotografia verificável da VM **sem** repetir fluxo de mídia. Somente leitura: commit/branch, processos/portas, gateway/Frappe/nginx, flags (`ENABLE_CUSTOM_PERMISSION_PROFILES`, `VITE_*`), `diagnose_access_groups_api`, `inspect_faq_v3_pilot`, logs por `request-id`.

Evoluir `ops/smoke/mvp-e2e.ps1`: rota, método, contexto, status, request-id, error.code, detalhe sanitizado, ação. Cobrir health, FAQ pública, flags, bundles/runtime, access-groups, permission-profiles, profile-assignments, 401/403. **502 = falha específica.**

---

### Fase 1 — Corrigir `access-groups` e revalidar perfis (PRIORIDADE)

Diagnóstico em gateway → Frappe → dados (`members_json`, `scopes_json`, `permission_profile`). Árvore: migrate pós-snapshot | corrigir JSON | patch `_serialize_group` | redeploy branch | flag gateway. **Sem** paliativo de permissão admin.

Aceite: access-groups, permission-profiles, profile-assignments → **200**; CRUD grupo smoke; biblioteca FAQ OK.

```bash
sudo -u frappe bash -lc "cd /var/crm/frappe-bench && bench --site crm.localhost execute \
  univesp_atendimento.homolog_seed.diagnose_access_groups_api"
grep ENABLE_CUSTOM_PERMISSION_PROFILES /var/crm/sso-gateway/.env
sudo tail -n 80 /var/log/supervisor/sso-gateway*.log
```

Backend: `admin.list_access_groups` → `_serialize_group`.

---

### Fase 2 — Auditoria mocks, fallback e build

Inventário por módulo (mock dev | E2E | seed homolog | fallback perigoso | API OK | API ausente). Módulos afetados: FAQ, fila OP, intake, aluno, dashboard, permissões, parâmetros, governança, auth, `studentSupport`, `AdminPermissionsPage.vue`.

Build VM SSO real: `VITE_ENABLE_MOCKS=false`, `VITE_SSO_DEV_BYPASS=false`, `VITE_HOMOLOG_PROFILE_PREVIEW=false`. Preview em trilha separada. Falha de API → estado explícito, **sem** fallback mock silencioso.

---

### Fase 3 — Dados reais em lotes rastreáveis

**Alunos:** coorte pequena → dry-run → dup e-mail/RA/CPF → `batch_id` → apply → validar → expandir. Descarte por lote, não `HOMOLOG%` cego. Script: `ops/import/students-from-trino.py`.

**OPs:** recuperar `staff-from-trino.py` de `0d30be08` (seletivo). CLI: `--validate-env`, `--dry-run`, `--apply`, `--sync-profiles`, etc.

**Perfis/grupos:** após Fase 1 — OPs/grupos reais; distinguir Access Profile / Permission Profile / Access Group / Assignment. Preservar seed `acesso-ava`.

---

### Fase 4 — Validação por persona (SSO real)

Admin, aprovador, OP, aluno, visitante `/publico` — testes positivos e negativos (401/403/409/404). FAQ pública anônima + mídia sem cookie admin.

---

### Fase 5 — Relatório e patches mínimos

Atualizar este doc com matriz API, mocks, build, carga, personas, rollback. Patches permitidos: 502, permission-profiles, smoke, fallbacks, build SSO, OP import, batch_id. **Fora de escopo:** merge main, Docker Compose, cutover prod, remoção ampla mocks, nova mídia. **Sem commit sem autorização.**

Referência smoke: `ops/smoke/mvp-e2e.ps1`, `docs/FAQ_V3_INTEGRATED_PILOT.md`.

---

## Branch e deploy

| Uso | Branch |
|-----|--------|
| **Deploy VM homolog** | `fix/bootstrap-homolog-unblock` |
| Cloud Run homolog (CI) | `univesp/cloudrun-homolog` |
| **Não usar na VM** | `codex/crm-ux-simulator-foundation` |

Fluxo: **local → commit → push → VM `git reset --hard` → scripts deploy** — ver `docs/ops/DEPLOY_VM_HOMOLOG.md`.

SSH Windows (IAP):

```powershell
# Terminal 1
gcloud compute start-iap-tunnel crm-vm 22 --local-host-port=localhost:2222 --zone=us-east1-b --project=univesp-201808
# Terminal 2
ssh -i $env:USERPROFILE\.ssh\univesp_bruno -p 2222 bruno.miyasato@127.0.0.1
```

---

## Infra TI entregue (2026-08-06)

- VM `crm-vm` resize `e2-standard-16`, IAP SSH
- Trino RO: secret `crm-homolog-trino-crm-import`
- GCS homolog: bucket `crm-univesp-uploads`, HMAC `crm-homolog-gcs-hmac`
- Prod: Cloud SQL `10.54.1.3`, Redis `10.142.0.116`, GCS `univesp-crm-attachments-prod`
- Snapshot rollback: `crm-vm-pre-prod-20260805`

Detalhe cofre: `docs/ops/COFRE_SECRETS_CRM.md`

---

## Conquistas sessão 2026-08-06

1. SSH IAP (túnel + chave `univesp_bruno`) operacional
2. GCS HMAC → `site_config` (`file_storage=s3`)
3. Nginx `/files/` → alias disco (gunicorn não serve estáticos)
4. FAQ: upload, simulador, persistência, publicação admin (`teste 2`)
5. Bundle piloto `bbbbbbbbb` publicado (`student`); `acesso-ava` na API pública
6. VM consultada: `teste`/`matricula` estão `archived`, sem `published_version`, com rascunhos históricos; não foram alterados

---

## Pendências imediatas

| # | Item | Fase |
|---|------|------|
| 1 | **Fase 0:** matriz API + baseline VM | 0 |
| 2 | **Fase 1:** corrigir `access-groups` 502 + permission-profiles | 1 |
| 3 | Confirmar higiene idempotente dos bundles `teste`/`matricula` (VM já os reporta arquivados) | pré-runtime |
| 4 | **Fase 2:** inventário mocks + build SSO real | 2 |
| 5 | **Fase 3:** coorte alunos + recuperar `staff-from-trino.py` | 3 |
| 6 | **Fase 4:** personas SSO real | 4 |
| 7 | Commit/push patches nginx + homolog_seed; VM sync `983886e6+` | 5 |
| 8 | Cutover prod MySQL | fora de escopo |

---

## Paths VM

```text
/var/crm/repository          # git
/var/crm/univesp-frontend    # Vue build → dist/
/var/crm/frappe-bench        # site crm.localhost
/var/crm/sso-gateway         # gateway :4000
/etc/nginx/sites-available/homolog-crm.univesp.br.conf
/etc/nginx/conf.d/crm-upstreams.conf
/var/crm/frappe-bench/sites/crm.localhost/public/files/   # mídia FAQ (/files/)
```

---

## Comandos smoke rápidos

```bash
# Features homolog (se flags/gateway incompletos)
sudo bash /var/crm/repository/ops/vm/scripts/enable-homolog-features.sh

curl -sf http://127.0.0.1:4000/health
curl -s -o /dev/null -w '%{http_code}\n' --resolve homolog-crm.univesp.br:443:127.0.0.1 \
  -H 'Cookie: ...' \
  https://homolog-crm.univesp.br/api/app/v1/admin/access-groups

sudo -u frappe bash -lc "cd /var/crm/frappe-bench && bench --site crm.localhost execute \
  univesp_atendimento.homolog_seed.inspect_faq_v3_pilot"
```

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br
```

---

## Evidências desta rodada de recuperação

### Fase 0 — baseline e matriz pública

VM consultada em modo somente leitura:

- repositório em `983886e6`; gateway `/var/crm/sso-gateway` usa o mesmo `app.js` do repositório por hash;
- gateway ativo em `:4000`, Frappe em `127.0.0.1:8000`, `ENABLE_CUSTOM_PERMISSION_PROFILES=true`;
- build atualmente servido ainda informa `VITE_ENABLE_MOCKS=false`, `VITE_SSO_DEV_BYPASS=false` e `VITE_HOMOLOG_PROFILE_PREVIEW=true` — o último foi corrigido apenas localmente;
- DocTypes `Univesp Access Group` e `Univesp Permission Profile` existem; os campos usados pela rota também existem;
- `diagnose_access_groups_api` lê e serializa o grupo diretamente no bench.

Smoke público salvo em `.tmp-artifacts/api-matrix-public-v2.json`:

| Contexto | Rotas | Resultado |
|----------|-------|-----------|
| Público | health, frontend, flags, FAQ pública | `200`; contratos de flags e `acesso-ava-homolog-v1` validados |
| Sem sessão | access-groups, permission-profiles, assignments, bundles, versões, runtime-settings | `401` |
| Admin SSO | mesmas rotas | pendente: cookie não fornecido ao script |
| Persona sem escopo | access-groups, permission-profiles, assignments | pendente: cookie não fornecido ao script |

Exemplos de request-id registrados: `smoke-f98f7ebfcead4c32855a57f80c014e8b` (flags), `smoke-45532eecb6544a70ac814ecabf226c53` (FAQ pública) e `smoke-f236e88dd2c44fc2b2eaec3b3f1b53e2` (401 access-groups).

### Fase 1 — causa comprovada e correção validada do `access-groups`

Request direto e assinado ao Frappe retornou `500` com `TypeError: 'NoneType' object is not callable` em `admin.py`, `_serialize_group`, na chamada de `value.as_dict()`. O gateway converte esse `500` interno em `502`. O grupo, JSON e schema estavam válidos; elevar permissão não é solução.

Patch aplicado em `admin.py`: serializers agora aceitam tanto `Document` quanto `frappe._dict` e só chamam `as_dict` quando ele é chamável. O mesmo tratamento foi aplicado aos serializers de perfil, usuário e solicitação. Commit `325f8a66` foi publicado na VM; o diagnóstico interno retornou `ok: true`, a tela `/admin/permissoes` carregou perfis/usuários reais e a aba Conhecimento exibiu o grupo `Aprovadores FAQ — Acesso ao AVA`.

### Fase 2 — mocks e build real

- `.env.production` local agora usa `VITE_HOMOLOG_PROFILE_PREVIEW=false`;
- `AdminPermissionsPage.vue` não exibe matriz, métricas ou usuários demonstrativos quando mocks estão desligados; mostra indisponibilidade explícita até as APIs reais responderem;
- falha de API de usuários/solicitações permanece visível em estado de erro;
- o inventário de imports diretos em `src/services/*Runtime.js` permanece pendente para uma segunda rodada por módulo, após o `200` de permissões.

Inventário inicial de dependências mock/fallback:

| Módulo | Classificação nesta rodada | Decisão |
|--------|----------------------------|---------|
| `faqRuntime.js`, `faqBuilderHybridRuntime.js` | seed institucional + fallback de desenvolvimento | preservar `acesso-ava`; exigir API real quando mocks estão desligados |
| `operatorQueueRuntime.js`, `operatorIntakeRuntime.js` | fallback perigoso / API a confirmar | não remover antes de smoke OP; bloquear fallback silencioso na próxima rodada |
| `adminDashboardRuntime.js`, `adminParametersRuntime.js` | métricas/configuração demo | validar API 200 antes de substituir; não usar em SSO real como evidência operacional |
| `studentPortalRuntime.js`, `studentSupportFlow.js`, `stores/studentSupport.js` | jornada demo/fallback | validar aluno real após higiene e coorte; sem carga nesta rodada |
| `auth.js`, `mockContextRuntime.js`, `canonicalFoundationRuntime.js` | preview/dev | `VITE_HOMOLOG_PROFILE_PREVIEW=false` no build real; preview permanece separado |
| `AdminPermissionsPage.vue` | mock hardcoded crítico | matriz, usuários e métricas demo bloqueados no build real; erro de API fica explícito |

### Fase 2.5 — higiene de bundles

Foi criado `homolog_seed.hygienize_homolog_bundles` com allowlist fixa (`teste`, `matricula`), confirmação `homolog-faq-v3`, `apply=false` por padrão, snapshot privado, retorno antes/depois e decisão segura entre excluir rascunho sem histórico ou arquivar histórico imutável. A VM reportou ambos os alvos como `archived`; nenhuma exclusão foi executada. `acesso-ava` e `bbbbbbbbb` não entram na allowlist.

### Fase 3 — preparação de dados reais

- alunos: `import_batch_id` adicionado ao diretório; `students-from-trino.py --apply` agora exige `--batch-id` e o dry-run não imprime PII completa;
- OPs: importador Trino e `Staff Directory` recuperados seletivamente do commit `0d30be08`, sem trazer o commit inteiro;
- nenhuma consulta Trino com carga nem apply foi executada;
- migration dos novos campos e carga da coorte continuam bloqueadas até fechar Fase 1 e autorizar publicação na VM.

### Rollback e risco residual

O patch backend foi publicado seletivamente, com backup em `/var/crm/backups/homolog-admin.py.20260806-224819`, sem migration ou seed. Frontend, DocTypes/importadores e helper de higiene ainda não foram instalados no bench. A higiene de bundles não deve ser executada com `apply=true` sem primeiro publicar o helper e revisar o dry-run na VM.

---

*Documento vivo — atualizar ao fechar cada fase ou mudar branch deploy.*
