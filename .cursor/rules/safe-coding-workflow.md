# Regra: Workflow de Código Seguro

## Fluxo Obrigatório
1. Definir escopo mínimo e objetivo operacional.
2. Aplicar o menor patch viável.
3. Validar somente o escopo alterado.
4. Reportar evidências, riscos e limitações.

## Restrições de Segurança
- Não alterar arquivos não relacionados.
- Não introduzir refatoração ampla sem aprovação explícita.
- Não tocar áreas protegidas (auth/rotas/serviços centrais/build) sem solicitação.

## Heurísticas de Patch
- Preferir edição local e incremental.
- Separar limpeza técnica de mudança de comportamento.
- Manter entrega pequena e revisável.

## Evidência Obrigatória
- Sempre incluir:
  - `git diff --stat`
  - `git status --short`
  - confirmação das categorias de arquivo alteradas
