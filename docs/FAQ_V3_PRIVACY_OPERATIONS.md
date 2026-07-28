# FAQ v3 — Privacidade, operação e métricas

Status: **v1** — gates LGPD para Fases 3–4; runbooks e metas de produto.
Documentos relacionados: [FAQ_V3_EXECUTION_SPEC.md](./FAQ_V3_EXECUTION_SPEC.md), [FAQ_V3_PRODUCT_UX_SPEC.md](./FAQ_V3_PRODUCT_UX_SPEC.md), [FAQ_V3_BACKLOG.md](./FAQ_V3_BACKLOG.md).

---

## 1. Escopo

- Dados pessoais, retenção, criptografia, acesso
- Matriz BPO/OP/Analista
- Decisões pendentes jurídico/DPO
- Runbooks operacionais
- Métricas de sucesso e baselines
- Responsáveis operacionais por tema/fila

**Não impede Fase 0.** Bloqueia **ativação produção** das Fases 3–4 sem decisões institucionais.

---

## 2. Achados LGPD (confirmados)

| Severidade | Achado | Mitigação exigida |
|------------|--------|-------------------|
| ALTO | Retenção indefinida (CPF, celular, documentos, sessão FAQ) | Política de retenção (seção 3) |
| ALTO | “CPF criptografado” sem especificação | Seção 4 |
| ALTO | Documentos privados sem matriz completa | Seção 5 |
| MÉDIO | Finalidade CPF/celular não exibida | Seção 6 |
| MÉDIO | Logs como segunda base de PII | Seção 7 |
| MÉDIO | BPO externo — escopo dados sensíveis | Seção 8 |

---

## 3. Retenção (decisão institucional obrigatória)

| Dado | Uso | Retenção proposta (placeholder) | Descarte |
|------|-----|----------------------------------|----------|
| CPF | Identificação atendimento | X anos após encerramento protocolo | Job anonimização |
| Celular | Contato | Idem protocolo | Mascaramento pós-prazo |
| E-mail pessoal | Contato/retorno | Idem | — |
| Documentos upload | Evidência | Idem + política documental | Delete storage |
| Sessão FAQ Redis | Sticky/telemetria | TTL + Y dias logs agregados | Expiração automática |
| Upload quarentena | Pré-protocolo | TTL intake (ex.: 24h) | Job limpeza |

**Gate Fase 3/4:** prazos aprovados por DPO/jurídico documentados em Runtime Settings `privacy_retention`.

---

## 4. CPF — criptografia

| Aspecto | Especificação mínima |
|---------|---------------------|
| Campo | `custom_student_cpf_encrypted` (ou DocType dedicado) |
| Algoritmo | AES-256-GCM ou equivalente institucional |
| Chave | KMS/GCP Secret Manager; rotação documentada |
| Acesso | Capacidade `view_sensitive_identity` + auditoria |
| Exibição | Mascarado `***.***.***-**` por padrão |
| Logs/URLs | **Proibido** CPF completo |
| Contingência | Procedimento rotação chave + re-encrypt |

---

## 5. Documentos privados

### 5.1 Matriz de acesso

| Perfil | Ver metadado | Download | Ver conteúdo |
|--------|--------------|----------|--------------|
| Aluno/público | Próprio protocolo | Próprio (Fase futura portal) | Próprio |
| OP | Sim, escopo polo | Auditado | Escopo caso |
| BPO | **Conforme seção 8** | Auditado | Limitado |
| Analista | Sim, área | Auditado | Área |
| Gestor | Sim | Auditado | Área |
| Admin | Sim | Auditado | Global |

### 5.2 Download

- URL assinada curta via BFF
- Log: quem, quando, protocolo, motivo
- Expiração link

### 5.3 Upload quarentena

- Bucket/prefix isolado
- Antimalware antes de vincular protocolo
- Rejeitados: retenção mínima para auditoria (ex.: 30 dias) depois delete

---

## 6. Finalidade e transparência (UI)

Na abertura pública, exibir por tipo de atendimento:

- **Finalidade:** registro e tratamento da solicitação
- **Dados coletados:** nome, CPF, e-mail, celular, vínculo (+ RA/curso/polo na Fase 4)
- **Base legal:** placeholder jurídico
- **Contato DPO/privacidade:** link institucional

Diferenciar **ciência do aviso** vs **consentimento** — decisão jurídico (seção 10).

---

## 7. Auditoria e logs

**Proibido registrar em logs de aplicação/access audit:**

- CPF completo
- Celular completo
- E-mail completo (preferir hash ou id)
- Conteúdo de documentos
- Payload playbook com PII

Permitido: IDs opacos, protocolo, bundle, versão, nó, ação, perfil.

---

## 8. BPO externo (`op_externo`)

| Dado | Default recomendado | Override |
|------|---------------------|----------|
| Celular mascarado | Sim | `view_contact_details` + escopo caso |
| CPF | **Não** | `view_sensitive_identity` + fluxo excepcional auditado |
| Documentos | **Metadado only** | Download só se grant explícito por tema |
| Playbook BPO | Sim, escopo regional | — |

Decisão institucional obrigatória antes de Fase 4 em produção.

---

## 9. Direitos do titular sem portal

Procedimento manual documentado:

- Canal institucional (e-mail privacidade)
- Localização protocolo por CPF hash + protocolo informado
- Prazo resposta LGPD
- Exportação/eliminação conforme retenção

---

## 10. Decisões pendentes (jurídico/DPO)

- [ ] Fundamento legal CPF obrigatório
- [ ] Texto aviso vs consentimento
- [ ] Prazos retenção (seção 3)
- [ ] Categorias documentais permitidas
- [ ] Acesso BPO a documentos/CPF
- [ ] Verificação e-mail (código temporário) — aprovar Fase 4

**Gate:** nenhuma flag `faq_public_documents` ou `faq_identity_verification` em **produção** sem checklist assinado.

---

## 11. Métricas de sucesso

### 11.1 Baseline (capturar na Fase 0)

| Métrica | Fonte atual |
|---------|-------------|
| % resolvido FAQ | Dashboard Admin |
| Escape pós-FAQ | Dashboard Admin |
| Tempo médio triagem OP | Operacional |
| Volume protocolo público | Tickets `source=publico` |

### 11.2 Metas pós-reforma (exemplo — calibrar com produto)

| Métrica | Meta direcional | Janela |
|---------|-----------------|--------|
| Resolvido pela FAQ | +5 pp vs baseline | 90 dias |
| Escape para atendimento | −10% vs baseline | 90 dias |
| Resolução 1º nível OP | +5 pp | 90 dias |
| Escalonamento indevido | −15% | 90 dias |
| Tempo criar/atualizar fluxo | −30% vs hoje | Por tema piloto |
| Erros publicação | < 2/mês | Contínuo |
| Sugestões dentro SLA | > 80% | Fase 2+ |
| Abandono formulário público | < 25% | Fase 3+ |
| Documentos rejeitados antimalware | Monitorar | Fase 3+ |
| Tempo fila validação humana | SLA definido | Fase 4 |

Telemetria: eventos da exec spec; agregação por `faq_session_id`.

---

## 12. Responsáveis operacionais

| Papel | Responsabilidade |
|-------|------------------|
| `owner_email` (Theme Governance) | Curadoria do tema |
| `approver_group` | Aprovação conteúdo |
| `fallback_admin_group` | Alerta SLA sugestões (**não aprova**) |
| Equipe validação identidade | Fila inconclusivos Fase 4 |
| Admin central | Publicação, flags, rollback |
| TI | GCS, antimalware, Redis, KMS |

Preencher por tema antes de Fase 2 ampla.

---

## 13. Runbooks

### 13.1 Rollback versão FAQ

1. Admin identifica versão target publicada
2. Executa rollback auditado (exec spec 8.6)
3. Comunica operação
4. Monitora escape rate 24h

### 13.2 Indisponibilidade Redis (sessões FAQ)

- Modo degradado: exigir revalidação caminho na abertura protocolo
- Alerta operação
- Não criar sessão sticky até restabelecer

### 13.3 GCS / antimalware indisponível

- `faq_public_documents` efetiva = false automaticamente
- UI oculta upload
- Protocolo sem documento obrigatório: **bloquear** abertura se policy required

### 13.4 Student Directory indisponível

- `faq_identity_verification` = false
- Fase 4 campos curso/polo: ocultos ou fila humana manual

### 13.5 Habilitação feature flags

| Flag | Quem habilita | Pré-requisito |
|------|---------------|---------------|
| `v3_read/write` | Admin + TI | Migrations homolog |
| `faq_public_anonymous` | Admin + DPO ciência | Privacy checklist parcial |
| `faq_public_documents` | Admin + DPO + TI | GCS + antimalware + retenção |
| `faq_identity_verification` | Admin + DPO | Directory + fila humana |
| `faq_public_email_thread` | Admin + TI | Ingress |

---

## 14. Feature flags — dependências (complemento)

| Flag | Efetiva quando |
|------|----------------|
| `v3_read` | rollout ON |
| `v3_write` | rollout ON + migrations |
| `faq_public_documents` | rollout + GCS + antimalware + privacy OK |
| `faq_identity_verification` | rollout + directory + fila + privacy OK |
| `faq_public_email_thread` | rollout + ingress |
| `knowledge_media_upload` | rollout + storage + antimalware |

Endpoints: `GET /api/app/v1/runtime/flags`, `GET /api/public/v1/runtime/flags`.

---

## 15. Histórico

| Versão | Notas |
|--------|-------|
| v1 | Split v4; LGPD, métricas, runbooks, BPO |
