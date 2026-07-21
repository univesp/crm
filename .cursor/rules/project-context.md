# Regra: Contexto do Projeto Primeiro

Antes de qualquer alteração de código, o agente deve ler obrigatoriamente:
- `AGENTS.md`
- `docs/SDD_CRM_UNIVESP.md`
- `docs/UX_PRINCIPLES_CRM.md`
- `docs/AI_WORKFLOW.md`
- `docs/VALIDATION_PLAYBOOK.md`
- documentação específica do domínio impactado em `docs/`

## Enforce
- Se faltar contexto, parar e levantar contexto antes de editar.
- Explicitar premissas arquiteturais na resposta.
- Preservar compatibilidade com contratos existentes de back-end (Frappe).

## Resultado Esperado
- Informar quais documentos orientaram a implementação.
- Explicar como a solução ajuda a reduzir chamados e escalonamento indevido.
