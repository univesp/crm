# Chamado TI — CRM UNIVESP (homolog + produção para testes reais)

**Sistema:** Atendimento / FAQ CRM UNIVESP  
**Repositório:** https://github.com/univesp/crm  
**Branch deploy:** `univesp/cloudrun-homolog`  
**Solicitante:** Equipe CRM / Bruno Miyasato  
**Data:** 2026-08-04  
**Prioridade:** Alta — homolog integrada + ambiente prod para stress/carga  

---

## 1. Contexto (1 parágrafo)

O CRM UNIVESP (Frappe 15 + gateway SSO + Vue) está pronto para **homologação real** e, em paralelo, pedimos **infra de produção provisionada** para testes de stress e carga antes do go-live. A VM `crm-vm` já existe (baseline jul/2026); o caminho acordado é **upgrade in-place**, não greenfield. Cadastro de alunos e operadores vem do **SEI via Trino** (batch diário); **não** é necessário import LDAP/AD no MVP. Referência técnica: `docs/TI_MINIMO_VS_CURSOR_PRODUCAO.md`.

---

## 2. Decisões já tomadas (não reabrir)

| Tema | Decisão |
|------|---------|
| Homolog | `https://homolog-crm.univesp.br` — **mantém como hoje** |
| Produção | `https://crm.univesp.br` — novo cutover |
| App | `crm-vm` resize **16 vCPU / 64 GB** |
| Redis | **VM dedicada** 2 vCPU / 8 GB (desde o início) |
| Banco | **Cloud SQL MariaDB 10.11** separado (dev faz dump/restore no cutover) |
| Trino | Conta técnica **`crm-import`** read-only (não conta pessoal) |
| LDAP/AD | **Fora do escopo MVP** — SSO + SEI bastam |
| SMTP | Opcional MVP — só confirmação 1-way ao abrir protocolo |
| Cloud Run | **Não** é pré-requisito deste chamado (VM é caminho principal) |

---

## 3. Escopo deste chamado

Provisionar **homolog + produção** num único pacote, para permitir:

1. SSO real, FAQ publicada, protocolos e fila OP em homolog  
2. **Testes de stress/carga em produção** (infra final) antes de abrir tráfego institucional  
3. Import batch SEI (~89k alunos AT, ~425 OP polo) após entrega de credenciais Trino  

**Equipe dev executa** após receber itens abaixo: deploy, migrate, import SEI, smoke, testes de carga.

---

## 4. Pedido — Homolog (`homolog-crm.univesp.br`)

### 4.1 Acesso e rede

- [ ] SSH para equipe dev na `crm-vm` (usuário + chave pública): _______________
- [ ] Confirmar bench em `/var/crm/frappe-bench`, site Frappe: _______________
- [ ] Redis homolog — IP/host:porta acessível **somente** da crm-vm: _______________
- [ ] Firewall: **443** público; **8000, 3306, 6379** fechados externamente

### 4.2 SSO / IdP

Cadastrar callbacks (Azure admin, Azure acadêmico, SAML):

```text
https://homolog-crm.univesp.br/api/sso/azure/callback
https://homolog-crm.univesp.br/api/sso/saml/callback
```

Entregar no **cofre** (nunca e-mail/Git):

- [ ] `AZURE_ADMIN_CLIENT_ID`, `AZURE_ADMIN_CLIENT_SECRET`, tenant admin  
- [ ] `AZURE_ACADEMICO_CLIENT_ID`, `AZURE_ACADEMICO_CLIENT_SECRET`, tenant acadêmico  
- [ ] Certificado SAML IdP + `SAML_IDP_SSO_URL`, `SAML_ENTITY_ID`  

### 4.3 Contas sintéticas de teste (IdP)

Criar contas **exclusivas** de homolog, com MFA e owner de expiração:

| Perfil | Uso | Escopo mínimo |
|--------|-----|----------------|
| Aluno | Login SAML/Azure acadêmico | FAQ + protocolo próprio |
| OP | Azure administrativo | Filas `atendimento-geral`, `sra`; polos piloto abaixo |
| Analista área | Azure administrativo | Área explícita |
| Admin central | Azure administrativo | Publicação FAQ, parâmetros |

Identificadores (sem senhas no chamado): _______________

### 4.4 Trino / SEI

- [ ] Conta **`crm-import`** (read-only) — usuário/senha no cofre  
- [ ] Rede **crm-vm → trino.univesp.br:443** liberada (validar **da VM**, não só workstation)  
- [ ] Confirmar catálogo `"postgresql-sei"` acessível com essa conta  

### 4.5 Operacional homolog

- [ ] Polos piloto para operação OP: _______________  
- [ ] Janela para smoke assistido (data/hora): _______________  
- [ ] Owner restore/rollback homolog: _______________  

---

## 5. Pedido — Produção (`crm.univesp.br`) — incluir **agora** para stress/carga

> Objetivo: infra **igual ao go-live** para testes reais de carga antes de abrir ao público. Homolog permanece no domínio atual.

### 5.1 Compute

- [ ] **Resize `crm-vm`** → 16 vCPU / 64 GB RAM, SSD ≥ 100 GB  
- [ ] **Nova VM Redis** — 2 vCPU / 8 GB, IP **privado**, porta 6379 só da crm-vm  
  - IP Redis prod: _______________

### 5.2 Banco de dados

- [ ] **Cloud SQL MariaDB 10.11** — instância dedicada, rede privada  
  - Spec sugerida para stress (~89k alunos Directory + tickets): **4 vCPU / 16 GB** (ajustável após teste)  
  - Host: _______________  
  - Database / user: _______________  
  - Credenciais: **[cofre]**  
- [ ] Backup automático + janela de restore testada — RTO/RPO: _______________

### 5.3 DNS e TLS

- [ ] DNS **`crm.univesp.br`** → crm-vm (HTTPS válido)  
- [ ] **`homolog-crm.univesp.br` inalterado**  
- [ ] Certificado TLS válido para ambos  

### 5.4 SSO produção

Mesmos paths, domínio prod:

```text
https://crm.univesp.br/api/sso/azure/callback
https://crm.univesp.br/api/sso/saml/callback
```

- [ ] Apps/registrations Azure + SAML atualizados para prod  
- [ ] Secrets prod no cofre (independentes de homolog)  

### 5.5 Storage e anexos

- [ ] Bucket GCS **privado** (anexos protocolo + mídia FAQ)  
- [ ] Service Account JSON: **[cofre]**  
- [ ] IAM: SA com acesso ao bucket; crm-vm usa SA ou JSON montado  

### 5.6 Rede e segurança prod

- [ ] Firewall: 443 público; app → Redis privado; app → Cloud SQL privado; app → Trino :443  
- [ ] Snapshot policy VM + Cloud SQL  
- [ ] SSH dev prod (mesmo ou usuário dedicado): _______________

### 5.7 Trino prod

- [ ] Mesma conta `crm-import` ou conta prod dedicada — **[cofre]**  
- [ ] Rede crm-vm prod → Trino :443 confirmada  

### 5.8 SMTP (opcional — pode adiar)

- [ ] Relay SMTP institucional para **1 e-mail de confirmação** ao abrir protocolo (aluno logado)  
- [ ] **Sem** reply-by-email / thread no MVP  

### 5.9 Observabilidade (recomendado para stress)

- [ ] Acesso dev a logs Nginx, Frappe workers, gateway SSO, Redis, Cloud SQL slow query  
- [ ] Métricas básicas CPU/RAM/disco crm-vm + Cloud SQL durante janela de carga  
- [ ] Canal de incidente janela de teste: _______________  
- [ ] Janela autorizada teste stress/carga prod: _______________

---

## 6. Formulário de entrega TI → dev (preencher e devolver)

```text
=== HOMOLOG ===
SSH crm-vm homolog: sim/não — user: ___
Redis homolog IP: ___
SSO homolog callbacks: sim/não
Contas sintéticas: aluno ___ | OP ___ | area ___ | admin ___
Trino crm-import homolog: [cofre] — rede VM OK: sim/não
Polos piloto: ___
Janela smoke: ___

=== PRODUÇÃO (stress/carga) ===
crm-vm 16/64: sim/não
redis-vm IP privado: ___
Cloud SQL host: ___ — user/db: [cofre]
DNS crm.univesp.br: sim/não — homolog intacto: sim/não
SSO prod callbacks: sim/não
GCS bucket + SA: [cofre]
Trino prod rede OK: sim/não
SMTP relay (opcional): ___ ou N/A
Snapshot/backup OK: sim/não
Janela stress/carga: ___
Owner go-live: ___
```

---

## 7. O que a equipe dev fará após entrega

| Fase | Ações dev |
|------|-----------|
| Homolog | pull, `bench migrate`, `.env.vm`, gateway/nginx, import SEI dry-run → apply piloto, FAQ publish, smoke |
| Prod (pré go-live) | cutover DNS interno/teste, MariaDB → Cloud SQL, Redis dedicado, import SEI full, perfis OP piloto |
| Stress/carga | cenários acadêmicos (login, FAQ, abertura protocolo, fila OP); relatório CPU/RAM/SQL |
| Go-live | smoke verde, mocks off, comunicação institucional |

Scripts: `ops/smoke/mvp-e2e.ps1`, `ops/import/sync-sei-directories.sh`, `docs/crm-sei-daily-sync.md`.

---

## 8. Fora de escopo deste chamado

- Import LDAP/AD via Trino  
- Correção catálogo `ad-adm` no Trino  
- Deploy Cloud Run (alternativa futura)  
- IA/RAG, LiteLLM exposto, Knowledge Studio público  
- 474 filas HD Teams por polo  
- SMTP thread reply-by-email  

---

## 9. Referências no repositório

| Documento | Conteúdo |
|-----------|----------|
| `docs/TI_MINIMO_VS_CURSOR_PRODUCAO.md` | Plano completo TI × dev, LDAP/AD, contagens SEI |
| `docs/TI_HOMOLOGACAO.md` | Cloud Run (alternativa) |
| `ops/vm/HANDOFF_TI.md` | Baseline VM jul/2026 |
| `docs/crm-sei-daily-sync.md` | Rotina import SEI |
| `docs/HOMOLOG_READINESS.md` | Gates homolog |

---

## 10. Contato

**Solicitante:** _______________  
**Equipe dev CRM:** _______________  
**Aprovação gestão TI:** _______________

---

*Chamado gerado em 2026-08-04. Anexar este arquivo ou link GitHub ao ticket ServiceNow/GLPI/Jira institucional.*
