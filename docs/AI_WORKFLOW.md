# Workflow de IA - CRM UNIVESP

## Objetivo
Padronizar a atuação de agentes para mudanças seguras, pequenas e verificáveis, preservando estabilidade operacional.

## Sequência Obrigatória
1. Entender pedido, restrições e perfil impactado (aluno, OP, gestor, admin).
2. Ler: `AGENTS.md`, `docs/SDD_CRM_UNIVESP.md`, `docs/UX_PRINCIPLES_CRM.md`, `docs/AI_WORKFLOW.md`, `docs/VALIDATION_PLAYBOOK.md` e, para homolog VM, `docs/ops/HOMOLOG_VM_STATUS.md`.
3. Mapear impacto e definir escopo mínimo.
4. Implementar patch pequeno e reversível.
5. Validar somente o escopo tocado, com evidências.
6. Reportar alterações, riscos, premissas e próximos passos.

## Disciplina de Escopo
- Uma preocupação principal por patch.
- Não expandir escopo sem aprovação explícita.
- Não alterar áreas protegidas silenciosamente.

## Checklist Pré-Edição
- Existe padrão já adotado que pode ser reutilizado?
- Existe alternativa de menor risco?
- A mudança preserva contratos e arquitetura atual?
- A UX resultante reduz chamado e evita escalonamento indevido?

## Checklist Pós-Edição
- Diff intencional e contido.
- Sem arquivos não relacionados alterados.
- Comandos de validação registrados.
- Riscos residuais explicitados quando houver.

## Gatilhos de Escalada
- Mudança em autenticação, sessão, permissões ou rotas.
- Mudança em contrato de serviço/API.
- Impacto em build, deploy ou infraestrutura.
- Refatoração ampla para resolver problema pontual.

## Deploy homolog VM (manual)

- Branch: `fix/bootstrap-homolog-unblock`
- Runbook: `docs/ops/DEPLOY_VM_HOMOLOG.md`
- Nao confundir com Cloud Run (`univesp/cloudrun-homolog`)
- Apos push: VM faz `git reset --hard origin/fix/bootstrap-homolog-unblock` + script do componente alterado
