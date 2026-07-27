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
- Import Trino via `ops/import/students-from-trino.py` (fonte: catalogo-dados-univesp)
- Validação pós-SSO: `POST /api/app/v1/students/validate`

## FAQ pública (não-aluno)

- `faq_type: publico` na biblioteca de conhecimento
- Rota `/publico` com registro leve + consentimento LGPD
- API pública: `/api/public/v1/*` (sem sessão SSO)
