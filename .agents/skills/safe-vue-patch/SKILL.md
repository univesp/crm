---
name: safe-vue-patch
description: Use para aplicar patches pequenos e seguros em componentes Vue do Sistema Polo/CRM UNIVESP, preservando arquitetura, contratos, rotas, permissões e estabilidade.
---

# Skill: safe-vue-patch

## Propósito
Aplicar patch mínimo no front-end Vue com risco controlado e sem regressão funcional não solicitada.

## Quando Usar
- Correções pontuais, ajustes de UX local e melhorias pequenas de interação.

## Fluxo
1. Ler `AGENTS.md`, SDD, UX, workflow e playbook de validação.
2. Mapear arquivos exatos e possíveis efeitos colaterais.
3. Implementar a menor alteração possível.
4. Validar apenas o escopo tocado.
5. Reportar mudança, impacto e risco residual.

## Regras de Segurança
- Não alterar rotas, autenticação, serviços centrais ou build sem solicitação explícita.
- Não mudar contrato com Frappe sem alinhamento explícito.
- Não ampliar escopo durante execução sem aprovação.

## Porta de Qualidade
- Diff pequeno e justificável.
- Sem arquivos não relacionados no patch.
- Evidências de validação registradas (`git diff --stat` e `git status --short`).
