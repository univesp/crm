# Retorno TI — Infraestrutura CRM UNIVESP

**Para:** Bruno Miyasato — Equipe CRM  
**De:** TI UNIVESP (lucas.teles@univesp.br)  
**Referência:** `TI_CHAMADO_HOMOLOG_PRODUCAO.md` (2026-08-04)  
**Data:** 2026-08-06  

> Mapeamento operacional dos secrets: `docs/ops/COFRE_SECRETS_CRM.md`  
> Runbook de corte prod: `docs/ops/CUTOVER_PROD_MYSQL.md`

---

## Resumo

Todos os itens do chamado (**A1–A5** e **B1–B8**) foram provisionados e validados.
Homologação seguiu operacional durante todo o processo, exceto por ~3 minutos de
parada planejada no resize da VM (B1).

Duas divergências em relação ao pedido original estão descritas na seção
[Divergências](#divergências) — leia antes de planejar o corte para produção.

---

## A. Homolog

| # | Item | Entregue |
|---|------|----------|
| A1 | SSH na `crm-vm` | `bruno.miyasato@univesp.br` — roles `iap.tunnelResourceAccessor` + `compute.osLogin` |
| A2 | Callbacks SSO homolog | Confirmados nos 3 apps Azure (Admin, Acadêmico, SAML SP) |
| A3 | Conta Trino `crm-import` | Criada em `login`/`password.db` do Trino → cofre `crm-homolog-trino-crm-import` |
| A4 | Rede `crm-vm → trino:443` | Liberada e **validada da VM** (HTTP 303) |
| A5 | GCS homolog | Bucket `crm-univesp-uploads` + SA `crm-attachments` → cofre `crm-homolog-gcs-sa-key` |

### Como acessar a VM

```bash
gcloud compute ssh bruno.miyasato@crm-vm \
  --project=univesp-201808 --zone=us-east1-b --tunnel-through-iap
```

O firewall só aceita SSH pela faixa do IAP (`35.235.240.0/20`) — a flag
`--tunnel-through-iap` é obrigatória.

**Windows (IAP tunnel + chave OpenSSH):**

```powershell
# Terminal 1
gcloud compute start-iap-tunnel crm-vm 22 --local-host-port=localhost:2222 --zone=us-east1-b --project=univesp-201808

# Terminal 2
ssh -i $env:USERPROFILE\.ssh\univesp_bruno -p 2222 bruno.miyasato@127.0.0.1
```

---

## B. Produção

| # | Item | Entregue |
|---|------|----------|
| B1 | Resize `crm-vm` | `e2-standard-2` → **`e2-standard-16`** (16 vCPU / 62 GB) |
| B2 | VM Redis dedicada | `crm-prod-redis` (e2-standard-2) — IP privado **`10.142.0.116`** |
| B3 | Banco gerenciado | `crm-prod-db` — **MySQL 8.0**, `db-custom-4-16384`, IP privado **`10.54.1.3`** |
| B4 | DNS `crm.univesp.br` | Registro A → `34.138.32.210`, proxied (Cloudflare). Homolog inalterado |
| B5 | Firewall | Ingress/egress Redis, Cloud SQL, Trino — **conectividade validada da VM** |
| B6 | Callbacks SSO prod | Adicionados nos 3 apps Azure + SP registrado no IdP `login.univesp.br` |
| B7 | GCS prod | Bucket `univesp-crm-attachments-prod` + SA `crm-attachments-prod` |
| B8 | Snapshot | `crm-vm-pre-prod-20260805` (50 GB). Cloud SQL com backup diário 03h, retenção 7d |

### Extra — não estava no chamado, mas foi necessário

| Item | Motivo |
|------|--------|
| **TLS `crm.univesp.br`** | Certificado Let's Encrypt emitido, renovação automática. Validade 2026-11-04 |
| **Server block nginx prod** | `crm.univesp.br` servindo (200 em `/` e `/login`) |
| **Cloud NAT** (`crm-nat-router` / `crm-nat`) | A VM Redis não tem IP externo e precisava dele para instalar pacotes |

---

## Credenciais — Secret Manager

Projeto `univesp-201808`. A service account **`crm-vm-sa`** já tem
`secretAccessor` em todas as entradas abaixo — a aplicação na VM lê direto,
sem precisar de chave em disco.

| Entrada | Conteúdo |
|---------|----------|
| `crm-homolog-trino-crm-import` | JSON: user, password, host, port, catalog |
| `crm-homolog-gcs-sa-key` | Chave JSON da SA de anexos (homolog) |
| `crm-prod-gcs-sa-key` | Chave JSON da SA de anexos (produção) |
| `crm-prod-redis-password` | Senha do Redis (`requirepass`) |
| `crm-prod-db-password` | Senha `root` do Cloud SQL |
| `crm-prod-db-frappe-password` | Senha do usuário `frappe` do Cloud SQL |

```bash
# ler uma entrada (na VM ou com gcloud autenticado)
gcloud secrets versions access latest \
  --secret=crm-prod-db-frappe-password --project=univesp-201808
```

**Nenhuma senha aparece neste documento nem está versionada em Git.**

Detalhe de **onde montar cada secret na aplicação:** `docs/ops/COFRE_SECRETS_CRM.md`.

---

## Divergências

### 1. MySQL 8.0 no lugar de MariaDB 10.11

O chamado pedia MariaDB 10.11 (B3). **O Cloud SQL não oferece MariaDB** — só
MySQL, PostgreSQL e SQL Server. Provisionei MySQL 8.0, que é o motor compatível
com Frappe e o mais próximo do pedido.

**Impacto para vocês:** se o plano assumia MariaDB especificamente (por
compatibilidade de dump, engine ou collation), vale validar antes da migração.
O Frappe suporta os dois, mas o `bench restore` de um dump MariaDB para MySQL
pode exigir ajuste de collation (`utf8mb4_unicode_ci`).

**Se MariaDB for requisito rígido**, a alternativa é uma VM com MariaDB
autogerenciada — me avisem que provisiono.

### 2. Produção e homologação compartilham a mesma stack

`crm.univesp.br` e `homolog-crm.univesp.br` apontam para a **mesma VM**, servem
o **mesmo Frappe**, usam o **mesmo banco local** e o **mesmo Redis local**.

O **Cloud SQL e a VM Redis que provisionei estão vazios e sem uso.** Eles estão
prontos, testados e com credenciais no cofre — mas ligar a aplicação neles é
decisão da Equipe CRM (runbook `docs/ops/CUTOVER_PROD_MYSQL.md`).

Enquanto isso não acontecer, **um erro em homologação derruba produção**.

---

## Referência rápida

```text
VM aplicação    crm-vm            34.138.32.210 / 10.142.0.98   e2-standard-16
VM Redis        crm-prod-redis    10.142.0.116                  e2-standard-2
Cloud SQL       crm-prod-db       10.54.1.3                     MySQL 8.0
Projeto GCP     univesp-201808
Zona            us-east1-b

Domínios        https://crm.univesp.br            (produção)
                https://homolog-crm.univesp.br    (homologação)

GCS homolog     crm-univesp-uploads
GCS prod        univesp-crm-attachments-prod

Contato TI      lucas.teles@univesp.br
```

---

*TI UNIVESP — 2026-08-06*
