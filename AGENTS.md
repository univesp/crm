# AGENTS - Sistema Polo/CRM UNIVESP

Este arquivo define a governança para agentes de IA neste repositório.

## Missão
- Preservar a estabilidade do sistema enquanto melhora orientação e operação.
- Tratar o Frappe como engine/back-end e o Vue como camada de experiência e operação.
- Reduzir chamados evitáveis com autosserviço, FAQ guiada e fluxos claros.
- Prevenir escalonamento indevido e proteger gestores de demanda bruta.

## Contexto Operacional Obrigatório
- Escala atendida: cerca de 100 mil alunos.
- Operação de ponta: cerca de 500 OPs/secretários.
- Equipe central: reduzida, com capacidade limitada para retrabalho.

## Ordem Obrigatória de Leitura (antes de alterar código)
1. `AGENTS.md`
2. `docs/SDD_CRM_UNIVESP.md`
3. `docs/UX_PRINCIPLES_CRM.md`
4. `docs/AI_WORKFLOW.md`
5. `docs/VALIDATION_PLAYBOOK.md`
6. Documentação específica do módulo impactado em `docs/`

## Regras Não Negociáveis
- Preferir patches pequenos, reversíveis e com baixo raio de impacto.
- Não alterar arquitetura, contratos ou comportamento sem solicitação explícita.
- Não misturar refatoração ampla com mudança funcional no mesmo patch.
- Explicar escopo, decisão e risco residual na entrega.

## Áreas Protegidas (exigem aprovação explícita)
- Autenticação, sessão, permissões e perfis.
- Rotas, guards e regras de navegação.
- Serviços centrais e contratos com o back-end.
- Build, deploy, pipelines e configuração de ambiente.

## Direção de Produto e UX
- Aluno deve entender estado atual, próximo passo e resultado esperado.
- OP/secretário deve triar e resolver com menos cliques e menos ambiguidade.
- Gestor deve atuar por exceção, não por fila bruta.
- Admin/FAQ Builder deve ser poderoso, porém progressivo e simples.

## Critério de Pronto para Tarefas de Agente
- Escopo mínimo necessário entregue.
- Sem alteração funcional não solicitada.
- Validação proporcional ao risco registrada.
- Evidências de verificação (`git diff --stat` e `git status --short`) anexadas.

