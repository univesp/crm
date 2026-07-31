# FAQ v3 — Privacidade, operação e métricas

Status: **v3** — inclui nota 2026-07: grupo aprovador é **condicional** (obrigatório ao enviar para revisão; opcional na criação de tema quando só Admin edita/publica).
Documentos relacionados: [FAQ_V3_EXECUTION_SPEC.md](./FAQ_V3_EXECUTION_SPEC.md), [FAQ_V3_PRODUCT_UX_SPEC.md](./FAQ_V3_PRODUCT_UX_SPEC.md), [FAQ_V3_BACKLOG.md](./FAQ_V3_BACKLOG.md).

---

## 1. Escopo

- Dados pessoais, retenção, criptografia, acesso
- Matriz BPO/OP/Analista
- Padrões institucionais adotados para o produto
- Runbooks operacionais
- Métricas de sucesso e baselines
- Responsáveis operacionais por tema/fila

Este documento não cria dependência externa de execução. A ativação é controlada
por flags e por verificações técnicas de armazenamento, antimalware, diretório e
e-mail.

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

## 3. Retenção

| Dado | Uso | Padrão adotado | Descarte |
|------|-----|----------------------------------|----------|
| CPF | Identificação do atendimento | Mesmo ciclo de retenção do protocolo | Campo criptografado; descarte acompanha o protocolo |
| Celular | Contato | Mesmo ciclo de retenção do protocolo | Descarte acompanha o protocolo |
| E-mail pessoal | Contato/retorno | Mesmo ciclo de retenção do protocolo | Descarte acompanha o protocolo |
| Documento vinculado | Evidência solicitada no fluxo | 180 dias por padrão | Job diário exclui objeto privado e registro |
| Evento FAQ identificável | Telemetria operacional | 90 dias | Job de retenção; agregados não identificáveis podem permanecer |
| Sessão FAQ Redis | Sticky version | 2 horas por padrão | Expiração automática |
| Upload em quarentena | Pré-protocolo | 24 horas | Job diário elimina intake e objetos não vinculados |
| Documento infectado/falho | Auditoria técnica sem conteúdo exposto | Até o menor prazo entre quarentena e retenção documental | Job diário |

Os prazos operacionais são configuráveis por Site Config/Runtime Settings.
Reduzir o prazo não exige alteração de schema nem redeploy. A exclusão de
protocolo segue a política institucional geral do Helpdesk e não é executada
por este módulo.

---

## 4. CPF — criptografia

| Aspecto | Especificação mínima |
|---------|---------------------|
| Campo | `Password` no Frappe (`custom_visitor_cpf`) e `Password` no Student Directory |
| Algoritmo | Criptografia de campo do Frappe; hash irreversível separado para busca |
| Chave | Chave do site protegida pelo Secret Manager; rotação via runbook |
| Acesso | Capacidade `view_sensitive_identity` + auditoria |
| Exibição | Mascarado `***.***.***-**` por padrão |
| Logs/URLs | **Proibido** CPF completo |
| Contingência | Procedimento rotação chave + re-encrypt |

---

## 5. Documentos privados

### 5.1 Matriz de acesso

| Perfil | Ver metadado | Download | Ver conteúdo |
|--------|--------------|----------|--------------|
| Aluno/público | Metadados durante a abertura | Sem download público persistente | Próprio upload antes da finalização |
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
- Rejeitados: nenhum vínculo com protocolo; descarte pelo job da quarentena

---

## 6. Finalidade e transparência (UI)

Na abertura pública, exibir por tipo de atendimento:

- **Finalidade:** registro e tratamento da solicitação
- **Dados coletados:** nome, CPF, e-mail, celular, vínculo (+ RA/curso/polo na Fase 4)
- **Fundamento do tratamento:** atendimento institucional e execução das
  atribuições públicas da Universidade
- **Contato DPO/privacidade:** link institucional

O aceite registra **ciência do aviso de privacidade**. Não é apresentado como
autorização genérica para usos incompatíveis com o atendimento.

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

Esse é o padrão efetivo. Exceções só podem ser concedidas por capacidade
específica, escopo de tema/caso, validade e auditoria.

---

## 9. Direitos do titular sem portal

Procedimento manual documentado:

- Canal institucional (e-mail privacidade)
- Localização protocolo por CPF hash + protocolo informado
- Prazo resposta LGPD
- Exportação/eliminação conforme retenção

---

## 10. Decisões adotadas

- CPF é opcional por padrão e só pode ser exigido quando o nó final declarar
  finalidade objetiva.
- O formulário registra ciência do aviso de privacidade.
- Documentos são aceitos somente em nó final, conforme catálogo MIME e política
  `optional|required`.
- BPO não visualiza CPF nem baixa documento por padrão.
- A validação de vínculo usa respostas públicas genéricas e fila humana para
  resultados inconclusivos.
- E-mail é correlacionado por token assinado; não cria novo protocolo em resposta.
- Flags só se tornam efetivas quando suas dependências técnicas respondem aos
  health checks.

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
| Operação da plataforma | GCS, antimalware, Redis, segredos e monitoramento |

O bootstrap cria os responsáveis do piloto. Novos temas exigem responsável,
grupo aprovador e fallback configurados antes da publicação.

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
| `v3_read/write` | Admin | Migrations e smoke homolog |
| `faq_public_anonymous` | Admin | FAQ pública publicada e rate limit |
| `faq_public_documents` | Admin | GCS privado + antimalware + job de retenção |
| `faq_identity_verification` | Admin | Directory + fila humana |
| `faq_public_email_thread` | Admin | SMTP autenticado ou relay confiável + ingress assinado |

---

## 14. Feature flags — dependências (complemento)

| Flag | Efetiva quando |
|------|----------------|
| `v3_read` | rollout ON |
| `v3_write` | rollout ON + migrations |
| `faq_public_documents` | rollout + GCS + antimalware + retenção |
| `faq_identity_verification` | rollout + directory + fila |
| `faq_public_email_thread` | rollout + ingress |
| `knowledge_media_upload` | rollout + storage + antimalware |

Endpoints: `GET /api/app/v1/runtime/flags`, `GET /api/public/v1/runtime/flags`.

---

## 15. Histórico

| Versão | Notas |
|--------|-------|
| v1 | Split v4; LGPD, métricas, runbooks, BPO |
| v2 | Remove placeholders e gates externos; fixa padrões técnicos configuráveis |
