# Safe Vue Patch

Patch minimo e seguro no Vue do CRM UNIVESP.

1. Ler `.cursor/rules/` e docs em `docs/`
2. Menor diff — sem auth, rotas, build ou Frappe sem pedido explicito
3. Validar escopo tocado
4. Evidencia: `git diff --stat` + `git status --short`
