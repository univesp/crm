# Chamado TI — CRM UNIVESP

**Sistema:** Atendimento / FAQ CRM  
**Homolog:** https://homolog-crm.univesp.br (`crm-vm` — stack operacional desde jul/2026)  
**Produção alvo:** https://crm.univesp.br  
**Responsável aplicação:** Equipe CRM (Bruno Miyasato) — opera VM, deploy e configuração após a infra abaixo  
**Repositório (referência):** https://github.com/univesp/crm  

---

## Pedido

Provisionar/liberar **somente infraestrutura e credenciais**. Deploy, código, FAQ, perfis de usuário e importação de dados ficam com a **Equipe CRM**.

---

## A. Homolog — liberar / confirmar

| # | Item |
|---|------|
| A1 | SSH na `crm-vm` para Equipe CRM |
| A2 | SSO homolog — confirmar callbacks (provavelmente já cadastrados) |
| A3 | Conta Trino **`crm-import`** (read-only) no cofre |
| A4 | Rede **crm-vm → trino.univesp.br:443** (validar da VM) |
| A5 | **GCS homolog** — bucket + Service Account no cofre (FAQ com mídia) |

Callbacks SSO:

```text
https://homolog-crm.univesp.br/api/sso/azure/callback
https://homolog-crm.univesp.br/api/sso/saml/callback
```

GCS homolog — sugestão: bucket `univesp-crm-attachments-homolog`, projeto `univesp-201808`.

---

## B. Produção / stress — provisionar

| # | Item | Spec |
|---|------|------|
| B1 | Resize `crm-vm` | 16 vCPU / 64 GB |
| B2 | VM Redis dedicada | 2 vCPU / 8 GB, IP privado |
| B3 | Cloud SQL MariaDB 10.11 | 4 vCPU / 16 GB, rede privada |
| B4 | DNS `crm.univesp.br` → crm-vm | Homolog **inalterado** |
| B5 | Firewall | 443 público; crm-vm → Redis, Cloud SQL, Trino, GCS (privado) |
| B6 | SSO prod — callbacks `https://crm.univesp.br/api/sso/...` |
| B7 | GCS prod (bucket ou prefixo dedicado) |
| B8 | Snapshot VM + backup Cloud SQL |

Opcional depois: SMTP (confirmação de protocolo).

Callbacks SSO prod:

```text
https://crm.univesp.br/api/sso/azure/callback
https://crm.univesp.br/api/sso/saml/callback
```

---

## Entrega de credenciais (cofre)

**Não enviar senhas neste documento nem no corpo do ticket.**

| Credencial | Entregar em |
|------------|-------------|
| Trino `crm-import` | Cofre / Secret Manager GCP — informar **nome da entrada** no retorno |
| GCS Service Account (JSON ou HMAC) | Idem |
| Cloud SQL (host, user, senha) | Idem |
| IdP (se ainda não configurados na VM) | Idem |

Sugestão: Secret Manager, projeto `univesp-201808`. Equipe CRM recebe **acesso de leitura** às entradas acordadas.

---

## Fora de escopo (TI não precisa fazer)

- Deploy, migrate, nginx, gateway, importação SEI, FAQ, perfis de acesso  
- Lista de usuários, polos ou convites  
- LDAP/AD, Cloud Run, IA/RAG  

---

## Retorno da TI (preencher no ticket)

```text
SSH crm-vm (Equipe CRM): sim/não — acesso: ___
SSO homolog OK: sim/não
Trino crm-import — cofre [nome: ___] — rede VM→Trino: sim/não
GCS homolog — bucket: ___ — cofre [nome: ___]

crm-vm 16/64: sim/não
Redis VM IP: ___
Cloud SQL — host: ___ — cofre [nome: ___]
DNS crm.univesp.br: sim/não
SSO prod OK: sim/não
GCS prod — bucket: ___ — cofre [nome: ___]
Janela stress/carga: ___
Contato TI: ___
```

---

*2026-08-04*
