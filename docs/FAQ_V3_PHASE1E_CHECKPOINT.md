# FAQ v3 — checkpoint da Fase 1e

## Resultado

O Editor v3 importa e compara XLSX, JSON v2, JSON v3 e
`procedure-capture-v1` antes de alterar o rascunho. A migração em massa da biblioteca
v2 passou a ser planejada e aplicada pelo backend com chave de idempotência.

## Entregas

- Template XLSX com abas `_meta` e `nodes`.
- Hash semântico por `stable_key` para comparação de três vias.
- Importação sem base com comparação de duas vias.
- Estados de diff: nova, alterada, movida, sem alteração, ausente e conflito.
- Linha ausente preservada por padrão.
- Decisão explícita para manter, remapear ou arquivar etapa ausente.
- Decisão explícita entre conteúdo atual e importado em conflito.
- Publicação bloqueada quando etapa ausente ainda participa de rota ativa.
- Preservação de `node_id`, mídia e chaves estáveis quando possível.
- Conversores para JSON v2, JSON v3 e `procedure-capture-v1`.
- Migração backend v2→v3 com agrupamento por tema, `node_map`, relatório de
  conflitos/órfãos e aplicação idempotente.
- BPO iniciado com herança integral do OP.
- Ownership, criticidade, SLA e rota carregados quando presentes na fonte.
- Endpoints autenticados de preview e aplicação da migração.
- Seed canônico v3 do piloto `acesso-ava`.
- Exemplo de mapeamento que não força a fusão de seeds com temas diferentes.

## Validação executada

- Ruff: aprovado.
- Testes puros de migração, grafo e roteamento: 13 aprovados.
- Typecheck Vue: aprovado.
- ESLint focado: aprovado.
- Build Vite de produção: aprovado, 454 módulos.
- Gateway: 17 testes aprovados.
- Playwright integrado: 6 testes aprovados.
- Seed `faq-v3-acesso-ava-seed.json`: validado pelo grafo canônico.

## Riscos e pendências

- O chunk do ExcelJS possui cerca de 940 KiB minificado. Ele é carregado sob demanda
  ao abrir a importação, mas o PWA ainda pode incluí-lo no precache.
- Os três seeds legados existentes representam temas diferentes. Eles não foram
  fundidos artificialmente. O piloto `acesso-ava` recebeu conteúdo público e playbook
  OP curados no seed v3.
- A publicação real do piloto em homolog requer executar os patches/DocTypes e os
  endpoints desta cadeia no site Frappe. O ambiente local não possui `bench` nem uma
  sessão Admin remota autenticada.

## Teste do usuário

**Opcional, recomendado apenas para validar a planilha.**

1. Abrir um rascunho no Editor.
2. Selecionar **Importar ou atualizar**.
3. Baixar a planilha do fluxo.
4. Alterar uma resposta e remover uma linha.
5. Reimportar a planilha.
6. Confirmar que a alteração aparece no diff e que a linha removida exige decisão.
7. Escolher **Manter no fluxo** e aplicar ao rascunho.

O teste técnico da migração em massa não é necessário.
