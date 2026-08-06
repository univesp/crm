# SDD - Sistema Polo/CRM UNIVESP

## Propósito do Sistema
O front-end em Vue organiza a experiência de atendimento acadêmico em alta escala, guiando aluno, OP/secretário e gestores para decisões corretas com menor custo operacional.

## Contexto de Operação
- Volume: cerca de 100 mil alunos.
- Operação local: cerca de 500 OPs/secretários.
- Equipe central: reduzida; o sistema precisa absorver demanda com autosserviço e triagem eficiente.

## Modelo Arquitetural
- Frappe: engine/back-end, regras de negócio, dados e estados oficiais.
- Vue: camada de experiência, orientação, fila operacional e produtividade.
- Princípio: o front-end simplifica a jornada sem violar contratos do back-end.

## Objetivos de Produto
- Reduzir chamados evitáveis com FAQ guiada e orientações objetivas.
- Evitar escalonamento indevido para áreas centrais.
- Proteger gestores de demanda bruta, priorizando atuação por exceção.
- Acelerar resolução para OP/secretário com fluxo previsível de triagem.

## Fronteiras Funcionais
- Não deslocar regra crítica de negócio para o cliente sem aprovação explícita.
- Preservar compatibilidade de contratos e integrações existentes.
- Manter separação entre camada de experiência e motor de processo.

## Diretrizes de Evolução
- Mudanças pequenas, locais e reversíveis.
- Reuso de padrões existentes antes de criar abstrações novas.
- Refatoração ampla só com justificativa e alinhamento explícito.

## Implicações para Agentes de IA
- Ler `AGENTS.md`, UX e workflow antes de editar código.
- Priorizar patches mínimos com validação proporcional ao risco.
- Escalar decisões que impactem auth, rotas, contratos ou pipeline.

## Evolução por fases (resumo)

| Fase | Escopo |
|------|--------|
| A0 | VM interim (`docker-compose.vm.yml`) + BFF + FAQ + tickets |
| A0b | GCS anexos (`univesp-crm-attachments-homolog`) |
| A1 | Cloud Run + Cloud SQL quando TI liberar |
| B | Perfil BPO (`op_externo`), PWA |
| C | Omnichannel (adapters → HD Ticket) |
| D | IA assistiva assíncrona pós-FAQ |
| E | App aluno (Capacitor) |
| F (posterior) | **Knowledge Studio** — curadoria ticket→candidatos FAQ, análise IA, export XLSX → FAQ Builder |

## Knowledge Studio (fase posterior — fora do escopo atual)

- **Status:** adiado até fechar validação UX/BFF do CRM na homolog.
- **Branch de referência:** `codex/knowledge-studio-future` (código preservado; não mergear no MVP).
- **Homolog:** não deployar `/studio/` nesta fase; serviço permanece parado.
- **Fluxo previsto:** import de protocolos (XLSX/CSV) → candidatos por tema → jobs IA → curadoria → XLSX → FAQ Builder no CRM.
- **Crawl manual:** apenas fontes de referência; não vira FAQ publicada diretamente.

## Base Cadastro Aluno

- DocType `Univesp Student Directory`
- Import Trino via `ops/import/students-from-trino.py` (fonte: catalogo-dados-univesp / `postgresql-sei`)
- Validação pós-SSO: `POST /api/app/v1/students/validate`
- Homolog VM (2026-08): piloto SEI importado; cofre Trino — `docs/ops/COFRE_SECRETS_CRM.md`

## Homologação VM (2026-08)

- Ambiente canônico operacional: `https://homolog-crm.univesp.br` na VM `crm-vm`
- Deploy manual: branch `fix/bootstrap-homolog-unblock` — `docs/ops/DEPLOY_VM_HOMOLOG.md`
- Status e pendências: `docs/ops/HOMOLOG_VM_STATUS.md`
- Cloud Run homolog (`univesp/cloudrun-homolog`) é pipeline **separado** da VM
- Prod cutover: `docs/ops/CUTOVER_PROD_MYSQL.md`

## FAQ pública (não-aluno)

> **Nota histórica (substituída em 2026-07):** a seção abaixo descrevia `faq_type: publico` como biblioteca separada e registro antes da FAQ. A regra canônica atual está em **FAQ e Orientações v3**.

- Legado: `faq_type: publico` na biblioteca v2
- Rota `/publico` com registro leve + consentimento LGPD (após consulta FAQ quando aplicável)
- API pública: `/api/public/v1/*` (sem sessão SSO)

## FAQ e Orientações v3 (canônico)

- **Um tema → um fluxo → uma árvore → um conjunto de nós.** Aluno e público externo são canais de apresentação do mesmo fluxo, não árvores distintas.
- OP, BPO e Analista percorrem os mesmos nós e recebem playbooks anexados (`playbooks.op|bpo|analyst`).
- Na criação: **Disponível em** (Portal do Aluno / Atendimento público sem login), um ou ambos.
- Conteúdo principal escrito uma vez; opção avançada por nó: personalizar texto para o público externo (`presentation.public_content_mode`: `inherit_student` | `custom`).
- Frappe é autoridade de publicação, versionamento, vigência, sticky version, auditoria e rollback.
- Governança: Analista edita e envia para aprovação; Gestor aprova; **Admin pode publicar rascunho próprio diretamente** (`approval_mode=admin_direct`) ou publicar versão aprovada. Revisão é opcional para Admin.
- Público consulta a FAQ antes de se identificar, quando o canal público estiver ativo.
- Editor: mapa gráfico (Vue Flow) + lista acessível + simulador de jornada (estado próprio, distinto do mapa).
