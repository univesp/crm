# Chamado TI — CRM UNIVESP (mínimo)

**Repo:** https://github.com/univesp/crm · **PR sync SEI:** #42  
**Homolog:** https://homolog-crm.univesp.br — VM `crm-vm`, stack **já no ar** (jul/2026).  
**Pedido:** liberar/provisionar **só infra** abaixo. **Deploy, migrate, import SEI, FAQ, perfis, convites = equipe dev.**

**Teste público (2026-08-04):** `/` e `/healthz` 200 · `/api/me` 401 · SSO `/api/sso/start` 302 · Frappe genérico 404 · smoke `mvp-e2e.ps1` **OK** (FAQ publicada, flags v3).

---

## O que a TI entrega

### A. Homolog (liberar / confirmar)

| # | Item | Observação |
|---|------|------------|
| A1 | SSH dev na `crm-vm` | Confirmar acesso (alias/IP ou IAP) |
| A2 | SSO homolog | Callbacks **confirmar** (provavelmente já OK) |
| A3 | Trino **`crm-import`** (RO) | Credencial no **cofre institucional** — ver § Entrega de segredos |
| A4 | Rede **crm-vm → trino.univesp.br:443** | Liberar e validar **da VM** |
| A5 | **GCS homolog** — bucket + Service Account | **Obrigatório agora** — FAQ com mídia (gestão/analistas populando antes da prod) |

Callbacks SSO (referência):

```text
https://homolog-crm.univesp.br/api/sso/azure/callback
https://homolog-crm.univesp.br/api/sso/saml/callback
```

GCS homolog (sugestão de nome): `univesp-crm-attachments-homolog` · projeto `univesp-201808` · ver `docs/ops/gcs-frappe-site-config.example.md`.

### B. Produção / stress (provisionar — dev faz cutover)

| # | Item | Spec |
|---|------|------|
| B1 | Resize **`crm-vm`** | 16 vCPU / 64 GB |
| B2 | **VM Redis** dedicada | 2 vCPU / 8 GB, IP privado |
| B3 | **Cloud SQL MariaDB 10.11** | 4 vCPU / 16 GB, rede privada |
| B4 | DNS **`crm.univesp.br`** | Homolog inalterado |
| B5 | Firewall | 443 público; app → Redis, Cloud SQL, Trino, GCS |
| B6 | SSO prod callbacks | `https://crm.univesp.br/api/sso/...` |
| B7 | **GCS prod** (ou prefixo no bucket homolog) | Anexos + mídia FAQ em prod |
| B8 | Snapshots VM + backup Cloud SQL | Janela stress/carga |

**Depois:** SMTP confirmação protocolo (opcional).

---

## Entrega de segredos (cofre) — **não preencher em doc Git**

A TI **não** coloca senhas neste arquivo nem no repositório.

| O quê | Onde entregar | Dev monta onde |
|-------|---------------|----------------|
| Trino `crm-import` user/senha | Cofre / ticket seguro / Secret Manager | `ops/import/.env.trino` na VM |
| GCS SA JSON ou HMAC keys | Cofre + referência no ticket | `/run/secrets/gcs-sa.json` + `site_config.json` |
| Cloud SQL user/senha (prod) | Cofre | `bench` `db_*` + `.env.vm` |
| IdP secrets (se ainda não na VM) | Cofre | `/var/crm/sso-gateway/.env` |

**No chamado TI:** marcar só *“entregue no cofre X”* ou *“Secret Manager: nome-do-secret”* — **sem valores**.

Sugestão de cofre: Secret Manager GCP (`univesp-201808`) ou cofre de senhas institucional acordado com TI. Dev recebe **acesso de leitura** ou link one-time.

---

## O que a TI **não** precisa fazer

- Lista de polos piloto, e-mails de teste ou convites — **product/dev conduz** (§ abaixo)  
- Deploy, migrate, nginx, import SEI, criar FAQ, perfis  
- Contas sintéticas IdP (opcional; usamos contas reais no piloto)  
- LDAP/AD, Cloud Run, IA/RAG  

---

## Como conduzimos o piloto (dev/product — sem TI)

1. **Import SEI full** em homolog (~89k alunos AT, ~425 OP polo) — dados reais no Directory.  
2. **Você manda o link** `https://homolog-crm.univesp.br` (login SSO) para gestão/analistas/OPs.  
3. **Primeiro login:** admin central (você) cria/ajusta `Univesp Access Profile` — perfil + filas + `polos` quando quiser restringir OP.  
4. **Polos piloto:** definidos **depois**, no Admin — não bloqueiam abrir homolog.  
5. **FAQ + mídia:** gestão/analistas publicam no Admin; mídia vai para **GCS** (por isso A5 é obrigatório).  
6. Alunos/OP usam **contas reais** que já existem (a sua, alunos teste, `@polo.univesp.br`).

---

## Devolve para dev (TI preenche só infra — sem segredos no ticket)

```text
SSH crm-vm: sim/não — como acessar: ___
SSO homolog OK: sim/não
Trino crm-import: entregue no cofre [nome: ___] — rede VM→Trino: sim/não
GCS homolog bucket: ___ — SA/cofre [nome: ___]

crm-vm 16/64: sim/não
Redis VM IP: ___
Cloud SQL host: ___ — cofre [nome: ___]
DNS crm.univesp.br: sim/não
SSO prod callbacks: sim/não
GCS prod: ___ — cofre [nome: ___]
Janela stress/carga: ___
```

---

## Dev faz após liberação

1. Merge PR #42 → migrate → `.env.trino` → import SEI full homolog  
2. Configurar GCS no site → gestão popula FAQ com mídia  
3. Perfis e convites via link (sem depender da TI)  
4. Prod: cutover SQL/Redis, stress, go-live  

Refs: `docs/TI_MINIMO_VS_CURSOR_PRODUCAO.md` · `docs/crm-sei-daily-sync.md` · `docs/ops/gcs-frappe-site-config.example.md`

---

*2026-08-04*
