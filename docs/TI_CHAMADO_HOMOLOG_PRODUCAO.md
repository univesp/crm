# Chamado TI — CRM UNIVESP (mínimo)

**Repo:** https://github.com/univesp/crm · **PR sync SEI:** #42  
**Homolog hoje:** `https://homolog-crm.univesp.br` — VM `crm-vm`, Frappe 15, Redis, SSO e código **já implantados** (jul/2026).  
**Pedido:** liberar/provisionar **só infra** abaixo. **Deploy, migrate, import SEI, FAQ, perfis e testes = equipe dev.**

---

## O que a TI entrega

### A. Homolog (validar / liberar — muito já existe)

| # | Item | Observação |
|---|------|------------|
| A1 | SSH dev na `crm-vm` | Se já temos, confirmar |
| A2 | Callbacks SSO homolog | Provavelmente já cadastrados — **confirmar** funcionam |
| A3 | Conta Trino **`crm-import`** (RO) + credencial no cofre | Import batch SEI |
| A4 | Rede **crm-vm → trino.univesp.br:443** | Testar **da VM** |

Callbacks (referência):

```text
https://homolog-crm.univesp.br/api/sso/azure/callback
https://homolog-crm.univesp.br/api/sso/saml/callback
```

### B. Produção / stress (provisionar máquinas e rede — dev faz o resto)

| # | Item | Spec |
|---|------|------|
| B1 | Resize **`crm-vm`** | 16 vCPU / 64 GB |
| B2 | **VM Redis** dedicada | 2 vCPU / 8 GB, IP privado, 6379 só da crm-vm |
| B3 | **Cloud SQL MariaDB 10.11** | 4 vCPU / 16 GB, rede privada, credenciais no cofre |
| B4 | DNS **`crm.univesp.br`** → crm-vm | Homolog **inalterado** |
| B5 | Firewall | 443 público; app → Redis, Cloud SQL, Trino :443 (privado) |
| B6 | Callbacks SSO **prod** | Mesmos paths, domínio `crm.univesp.br` |
| B7 | GCS bucket + SA (anexos FAQ) | JSON no cofre — **pode adiar** se FAQ só texto no piloto |
| B8 | Snapshot VM + backup Cloud SQL | Para janela de stress |

**Opcional / depois:** SMTP (confirmação protocolo), observabilidade formal.

---

## O que a TI **não** precisa fazer

- Deploy de código, `bench migrate`, nginx, gateway, frontend  
- Import LDAP/AD, Cloud Run, contas sintéticas obrigatórias, IA/RAG  
- Criar FAQ, perfis de acesso, polos piloto — **dev/product**

---

## Contas de teste — contas reais OK

**Sim.** Para homolog/piloto podemos usar **contas reais** que vocês já têm:

- Sua conta (admin / analista, conforme `Univesp Access Profile`)  
- Alunos de teste que você já usa  
- OP `@polo.univesp.br` e **polos que você conhece** (ex.: 237)

Fluxo: login SSO real → admin vincula `Univesp Access Profile` (perfil + escopo `polos` / filas).  
**Não** colocar senhas no chamado, Git ou ticket. Homolog não é produção aberta — limitar quem acessa.

Contas sintéticas IdP são recomendadas só para **aceite formal** institucional; **não bloqueiam** o piloto com contas reais.

---

## Devolve para dev (preencher)

```text
SSH crm-vm: sim/não
SSO homolog OK: sim/não
Trino crm-import: [cofre] — rede VM→Trino: sim/não

crm-vm 16/64: sim/não
Redis VM IP: ___
Cloud SQL host: ___ — credenciais: [cofre]
DNS crm.univesp.br: sim/não
SSO prod callbacks: sim/não
GCS (se já): [cofre] ou adiar
Janela stress/carga: ___
```

---

## Dev faz após liberação

1. Merge PR #42 → pull, `bench migrate`, `.env.trino`, import SEI  
2. Homolog: FAQ publish, perfis (suas contas + polos piloto), smoke  
3. Prod: cutover MariaDB→Cloud SQL, Redis→VM nova, import full, stress/carga  
4. Go-live quando smoke verde  

Detalhe técnico: `docs/TI_MINIMO_VS_CURSOR_PRODUCAO.md` · `docs/crm-sei-daily-sync.md`

---

*2026-08-04 — versão mínima*
