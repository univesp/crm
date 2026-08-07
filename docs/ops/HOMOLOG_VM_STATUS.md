# Status homolog VM — handoff operacional

**Atualizado:** 2026-08-07 — resultado da validação manual e erro de criação de áreas registrados
**Branch alvo:** `fix/bootstrap-homolog-unblock` @ `9b4d4c24` (correção backend de áreas publicada; frontend já havia sido publicado em `655367e4`; documentação anterior em `b6ff9cc7`)
**Alterações locais pendentes (preservar):** `.tmp-artifacts/` (evidências locais não versionadas)
**Ambiente:** `https://homolog-crm.univesp.br` na VM `crm-vm` (GCP `univesp-201808`, IAP SSH)  
**Para agentes:** leia junto com `docs/ops/DEPLOY_VM_HOMOLOG.md`, `docs/RETORNO_TI_EQUIPE_CRM.md`, `docs/ops/COFRE_SECRETS_CRM.md`, `docs/FAQ_V3_INTEGRATED_PILOT.md`

---

## Fase atual

**Homolog VM — FAQ v3, permissões, higiene em dry-run e telas admin/públicas validados; próximo passo: completar personas SSO. Dados Trino adiados.**

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
| FAQ runtime público anônimo | **Validado** | `/publico` carregou `Acesso ao AVA`; API pública e flags já validadas |
| **`access-groups`** | **Validado após patch** | diagnóstico interno `ok: true`; grupo carregado na tela admin |
| **`permission-profiles`** | **Validado após patch** | perfis e usuários reais carregados em `/admin/permissoes` |
| Usuários / personas / seeds | **Auditoria inicial** | imports mock/hardcode identificados; OP Trino recuperado localmente |
| Jornadas por persona | **Parcial** | admin e visitante validados; aprovador, OP e aluno SSO permanecem pendentes |

### Validação manual adicional — 2026-08-07

HAR recebido da sessão admin: 86 requisições; 83 respostas `200`, um `302` de logout e um `401` esperado em `/api/me` após a saída. O único erro funcional foi `POST /api/app/v1/admin/areas`, `417`, request-id `40a8ec0e-2171-4f59-a095-b191b886f29a`.

**Causa confirmada:** `create_institutional_area` passava `area_key` para o campo `target_email` de `Univesp Access Audit`. Como esse campo é do tipo Email, o Frappe rejeitava a chave da área e desfazia a criação inteira.

**Correção publicada:** o audit usa o e-mail do ator, preservando o contrato existente, e grava `resource_type`, `area_key` e `area_label` em `after_json`. Foi acrescentado teste de regressão em `test_admin_access.py`. Sintaxe, `git diff --check` e compilação Python passaram. O commit `9b4d4c24` foi publicado na branch e aplicado na VM pelo runbook de deploy; a migração e o restart do backend concluíram. A suíte Frappe não executou na VM porque a versão instalada não exporta `IntegrationTestCase` de `frappe.tests`; isso é incompatibilidade do harness de teste, não falha funcional da correção.

**Aluno SSO:** a tela de acesso pendente é coerente com `session.get_context`: sem `Univesp Access Profile` ativo, o sistema cria/atualiza `Univesp Access Request` e não libera a sessão operacional. A carga do Trino atualiza `Univesp Student Directory`, mas não concede perfil automaticamente. Para a validação da coorte, é necessário confirmar o diretório e aprovar a solicitação como `aluno` pelo fluxo administrativo; automatizar concessão por Trino seria mudança de autenticação/provisionamento e fica fora deste patch.

**Ajuste do checklist:** não há tela CRUD dedicada de grupos de acesso no build real. A API existe e é consumida pelas concessões de conhecimento da FAQ. A aba `Áreas` existe em `/admin/permissoes?tab=areas`; a área de perfis no build SSO real bloqueia a matriz demonstrativa e não oferece criação/edição de perfil. Portanto, CRUD de grupos/perfis deve ser validado por API/bench nesta fase, ou virar uma entrega UX separada; não deve ser cobrado como uma tela inexistente.

**Rechecagem IAP anterior:** SSH voltou a responder na `crm-vm` em `d211016c`. Consulta agregada no site retornou zero solicitações de acesso e a busca da identidade testada no `Student Directory` retornou zero registros, apesar da tela de acesso pendente. Antes de aprovar ou carregar dados, repetir o login com Network aberto e correlacionar a resposta de `/api/me` (`access.status` e `access.request_id`) com a listagem administrativa; se continuar sem registro, investigar persistência/site-alvo.

**Pós-deploy 2026-08-07:** o smoke externo salvou `.tmp-artifacts/api-matrix-after-admin-area-deploy.json`: health/frontend/flags/FAQ pública retornaram `200`, rotas protegidas sem sessão retornaram `401` e `POST /api/ingress/v1/tickets` sem segredo retornou `401`. As linhas autenticadas ficaram `SKIP` por ausência de cookie no script. A validação funcional restante é cadastrar uma área pela sessão admin e repetir o fluxo de aprovação de uma solicitação SSO.

**Fluxo considerado concluído:**

> editar → subir imagem → salvar → publicar → recarregar

**Não fazer novos patches de mídia** salvo regressão comprovada.

### Ajustes confirmados no plano de recuperação

| Item | Estado |
|------|--------|
| `VITE_ENABLE_MOCKS=false` | Documentado, mas **imports diretos** de `mocks/` persistem — flag sozinha não garante operação real |
| `.env.production` | **Publicado** | build real com `VITE_HOMOLOG_PROFILE_PREVIEW=false` |
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

Build VM SSO real: `VITE_ENABLE_MOCKS=false`, `VITE_SSO_DEV_BYPASS=false`, `VITE_HOMOLOG_PROFILE_PREVIEW=false`. Preview em trilha separada. Falha de API → estado explícito, **sem** fallback mock silencioso. Build publicado e painel admin validado sem matriz demonstrativa.

Validação adicional na sessão admin real: Dashboard, Protocolos, Validação de vínculo, Parâmetros, Permissões e Biblioteca FAQ carregaram sem erros de console. Permissões exibiu usuários e perfis vindos da API, e a aba Conhecimento exibiu o grupo real `Aprovadores FAQ — Acesso ao AVA` e concessões ativas para o tema `Acesso ao AVA`. O Dashboard mostrou zero atendimentos porque a base operacional ainda não foi carregada; isso não foi tratado como dado demo.

---

### Fase 3 — Dados reais em lotes rastreáveis (adiada por decisão operacional)

**Alunos:** coorte pequena → dry-run → dup e-mail/RA/CPF → `batch_id` → apply → validar → expandir. Descarte por lote, não `HOMOLOG%` cego. Script: `ops/import/students-from-trino.py`. A carga foi explicitamente deixada para depois; nenhum `--apply` será executado nesta rodada.

**OPs:** recuperar `staff-from-trino.py` de `0d30be08` (seletivo). CLI: `--validate-env`, `--dry-run`, `--apply`, `--sync-profiles`, etc.

**Perfis/grupos:** após Fase 1 — OPs/grupos reais; distinguir Access Profile / Permission Profile / Access Group / Assignment. Preservar seed `acesso-ava`.

---

### Fase 4 — Validação por persona (SSO real)

Admin e visitante `/publico` já foram validados. Ficam para a próxima rodada: aprovador, OP e aluno SSO, incluindo testes negativos (401/403/409/404). FAQ pública anônima + mídia sem cookie admin já têm evidência de API/HTTP; falta completar a jornada autenticada de aluno.

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
| 1 | **Fase 0:** matriz API + baseline VM | concluída; smoke público/401 e evidências registradas |
| 2 | **Fase 1:** corrigir `access-groups` 502 + permission-profiles | concluída; 200 e UI admin validados |
| 3 | Higiene dos bundles `teste`/`matricula` | concluída em dry-run; sem exclusão porque já estão arquivados |
| 4 | **Fase 2:** inventário mocks + build SSO real | fallbacks críticos bloqueados; OP/área ainda aguardam APIs e personas reais |
| 5 | **Fase 3:** coorte alunos + OPs via Trino | adiada; nenhum apply |
| 6 | **Fase 4:** aprovador, OP e aluno SSO | próxima rodada |
| 7 | Smoke autenticado completo e atualização final deste relatório | próxima rodada |
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

- repositório em `74d36a3e`; gateway `/var/crm/sso-gateway` usa o mesmo `app.js` do repositório por hash;
- gateway ativo em `:4000`, Frappe em `127.0.0.1:8000`, `ENABLE_CUSTOM_PERMISSION_PROFILES=true`;
- build servido após deploy usa `VITE_ENABLE_MOCKS=false`, `VITE_SSO_DEV_BYPASS=false` e `VITE_HOMOLOG_PROFILE_PREVIEW=false`;
- DocTypes `Univesp Access Group` e `Univesp Permission Profile` existem; os campos usados pela rota também existem;
- `diagnose_access_groups_api` lê e serializa o grupo diretamente no bench.

Smoke público salvo em `.tmp-artifacts/api-matrix-public-v2.json`:

| Contexto | Rotas | Resultado |
|----------|-------|-----------|
| Público | health, frontend, flags, FAQ pública | `200`; contratos de flags e `acesso-ava-homolog-v1` validados |
| Sem sessão | access-groups, permission-profiles, assignments, bundles, versões, runtime-settings | `401` |
| Admin SSO | mesmas rotas | `200` confirmado no painel autenticado; grupos/perfis reais carregados |
| Persona sem escopo | access-groups, permission-profiles, assignments | pendente: cookie não fornecido ao script |

Exemplos de request-id registrados: `smoke-f98f7ebfcead4c32855a57f80c014e8b` (flags), `smoke-45532eecb6544a70ac814ecabf226c53` (FAQ pública) e `smoke-f236e88dd2c44fc2b2eaec3b3f1b53e2` (401 access-groups).

### Fase 1 — causa comprovada e correção validada do `access-groups`

Request direto e assinado ao Frappe retornou `500` com `TypeError: 'NoneType' object is not callable` em `admin.py`, `_serialize_group`, na chamada de `value.as_dict()`. O gateway converte esse `500` interno em `502`. O grupo, JSON e schema estavam válidos; elevar permissão não é solução.

Patch aplicado em `admin.py`: serializers agora aceitam tanto `Document` quanto `frappe._dict` e só chamam `as_dict` quando ele é chamável. O mesmo tratamento foi aplicado aos serializers de perfil, usuário e solicitação. Commit `325f8a66` foi publicado na VM e o deploy completo posterior em `74d36a3e` manteve a correção; o diagnóstico interno retornou `ok: true`, a tela `/admin/permissoes` carregou perfis/usuários reais e a aba Conhecimento exibiu o grupo `Aprovadores FAQ — Acesso ao AVA`.

### Fase 2 — mocks e build real

- `.env.production` publicado usa `VITE_HOMOLOG_PROFILE_PREVIEW=false`;
- `AdminPermissionsPage.vue` não exibe matriz, métricas ou usuários demonstrativos quando mocks estão desligados; mostra indisponibilidade explícita até as APIs reais responderem;
- falha de API de usuários/solicitações permanece visível em estado de erro;
- o inventário de imports diretos em `src/services/*Runtime.js` permanece pendente para uma segunda rodada por módulo; o build real já bloqueia a matriz demonstrativa do Admin.

Inventário inicial de dependências mock/fallback:

| Módulo | Classificação nesta rodada | Decisão |
|--------|----------------------------|---------|
| `faqRuntime.js`, `faqBuilderHybridRuntime.js` | seed institucional + fallback de desenvolvimento | preservar `acesso-ava`; exigir API real quando mocks estão desligados |
| `operatorQueueRuntime.js`, `operatorIntakeRuntime.js` | fallback perigoso / API a confirmar | não remover antes de smoke OP; bloquear fallback silencioso na próxima rodada |
| `adminDashboardRuntime.js`, `adminParametersRuntime.js` | métricas/configuração demo | validar API 200 antes de substituir; não usar em SSO real como evidência operacional |
| `studentPortalRuntime.js`, `studentSupportFlow.js`, `stores/studentSupport.js` | jornada demo/fallback | validar aluno real após higiene e coorte; sem carga nesta rodada |
| `auth.js`, `mockContextRuntime.js`, `canonicalFoundationRuntime.js` | preview/dev | `VITE_HOMOLOG_PROFILE_PREVIEW=false` no build real; preview permanece separado |
| `AdminPermissionsPage.vue` | mock hardcoded crítico | matriz, usuários e métricas demo bloqueados no build real; erro de API fica explícito |

Auditoria objetiva dos imports diretos em `src/` encontrou dependências de mocks em `IntegrationsPage.vue`, `OverviewPage.vue`, `services/adminDashboardRuntime.js`, `adminFaqBuilderRuntime.js`, `adminParametersRuntime.js`, `adminPermissionsRuntime.js`, `areaGovernanceRuntime.js`, `canonicalFoundationRuntime.js`, `faqBuilderHybridRuntime.js`, `faqRuntime.js`, `mockContextRuntime.js`, `operationalOwnershipReferences.js`, `operatorIntakeRuntime.js`, `operatorQueueRuntime.js`, `studentPortalRuntime.js`, `studentSupportFlow.js`, `stores/journey.js` e `stores/studentSupport.js`.

Classificação operacional: FAQ v3 e `acesso-ava` permanecem como seed/piloto institucional; permissões administrativas estão protegidas no build real; fila OP, intake, aluno, dashboard, parâmetros e governança ainda dependem de APIs/contratos não validados em `200` e não devem ter os mocks removidos nesta rodada. `IntegrationsPage`, `OverviewPage` e `journey` continuam explicitamente demonstrativos, fora da evidência SSO. Remoção ampla foi adiada para evitar transformar telas sem API correspondente em telas quebradas.

Patches adicionais desta rodada bloquearam dois vazamentos de dados demo no build real: `studentPortalRuntime` agora usa protocolos seed somente quando `VITE_ENABLE_MOCKS=true`, protegendo listagem, busca e detalhe do portal do aluno; `AdminParametersPage` inicia vazio quando mocks estão desligados, evitando exibir níveis/SLAs demo se a API falhar. A aba Conhecimento também deixou de engolir falhas de catálogo e passou a exibir alerta explícito. Nenhum contrato, rota ou permissão foi alterado.

O patch foi publicado somente no frontend da VM em `655367e4`: sincronização do repositório, build Vite e reload nginx concluídos. Hash servido e hash de `dist/index.html`: `index-v1O-dV7s.js`. Gateway `:4000`, `healthz` e processos Supervisor permaneceram saudáveis. Smoke pós-deploy salvo em `.tmp-artifacts/api-matrix-after-fallback-patch.json`: rotas públicas `200` e rotas protegidas sem sessão `401`; linhas autenticadas continuam `SKIP` por ausência de cookie no script.

#### Validação de telas na sessão SSO real

| Tela/entrada | Resultado | Observação |
|---|---|---|
| `/admin/dashboard` | **200/UI OK** | sem erro de console; dados operacionais zerados por ausência de carga real |
| `/admin/protocolos` | **200/UI OK** | diretório vazio, sem seed demo exibido |
| `/admin/validacao-vinculo` | **200/UI OK** | estado de pendências carregado sem erro |
| `/admin/parametros` | **200/UI OK** | catálogos e SLAs carregados |
| `/admin/permissoes` | **200/UI OK** | usuários, perfis, grupos e concessões reais carregados |
| `/admin/faq` | **200/UI OK** | três bundles publicados, incluindo `acesso-ava` |
| `/publico` | **200/UI OK** | consulta anônima exibiu `Acesso ao AVA` |
| `/op/fila`, `/area/operacao` com admin | **guard OK** | redirecionamento para `/admin/dashboard`, como esperado para persona sem perfil operacional |

Observação: `/admin/auditoria` e `/admin/publicacao` também redirecionam para as telas canônicas de protocolos e FAQ. Não foram tratados como falha de API, mas são aliases/rotas a revisar se a navegação continuar apontando para esses caminhos.

### Fase 2.5 — higiene de bundles

Foi publicado `homolog_seed.hygienize_homolog_bundles` com allowlist fixa (`teste`, `matricula`), confirmação `homolog-faq-v3`, `apply=false` por padrão, snapshot privado, retorno antes/depois e decisão segura entre excluir rascunho sem histórico ou arquivar histórico imutável. O dry-run na VM reportou ambos os alvos como `archived` e decidiu `skip_inactive`; nenhuma exclusão foi executada. `acesso-ava` e `bbbbbbbbb` não entram na allowlist.

### Fase 3 — preparação de dados reais

- alunos: `import_batch_id` adicionado ao diretório; `students-from-trino.py --apply` agora exige `--batch-id` e o dry-run não imprime PII completa;
- OPs: importador Trino e `Staff Directory` recuperados seletivamente do commit `0d30be08`, sem trazer o commit inteiro;
- nenhuma consulta Trino com carga nem apply foi executada;
- migration dos novos campos foi concluída no deploy; carga da coorte continua pendente e exige dry-run/coorte autorizada.
- pré-requisitos Trino estavam ausentes no início da sessão; foram montados temporariamente na VM, sem commit e sem exibição de credenciais.

Atualização posterior da Fase 3: o ambiente Trino foi montado na VM sem registrar credenciais no Git. A validação passou; o dry-run aluno com `TRINO_CATALOG=postgresql-sei` retornou 10 linhas válidas, 9 e-mails únicos, 1 duplicidade de e-mail e 1 duplicidade de hash de CPF, com amostras mascaradas. O dry-run OP retornou 10 linhas e 10 e-mails únicos. O segredo atualmente informa `TRINO_CATALOG=univesp-crm-une`, catálogo que contém tabelas de atendimento e não as tabelas acadêmicas; o override foi usado apenas em memória. Nenhum `--apply` foi executado. Antes da carga, corrigir o catálogo no Secret Manager/configuração e definir a coorte autorizada.

### Rollback e risco residual

O deploy completo foi protegido por backup em `/var/crm/backups/pre-deploy-20260806T225720Z` e pelo backup do arquivo `/var/crm/backups/homolog-admin.py.20260806-224819`. Backend, DocTypes, importadores, helper de higiene e frontend estão publicados; não houve carga real de alunos/OPs. O build reportou 6 vulnerabilidades npm (3 moderadas, 3 altas) e chunks grandes; o preflight operacional retornou 0 erros e 0 avisos. A migration também registrou avisos legados de hooks `crm.api.event` inexistentes, sem falhar.

---

*Documento vivo — atualizar ao fechar cada fase ou mudar branch deploy.*
