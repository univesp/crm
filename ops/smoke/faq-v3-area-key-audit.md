# Auditoria de área responsável da FAQ publicada

Executar de forma somente leitura antes de habilitar dados reais:

```bash
bench --site <site> execute "univesp_atendimento.knowledge_audit.audit_published_bundle_area_keys"
```

O resultado lista apenas bundle, nó e situação de governança. Não inclui dados
do aluno nem altera versões.

Critérios:

- `blocking_nodes` deve ser `0`. Um nó final sem `operational.area_key` e sem
  `metadata.operational_owner` de área não tem área efetiva para o roteamento.
- `missing_area_key` deve ser tratado antes da publicação seguinte. Quando a
  área existe somente no `operational_owner` legado, o roteamento ainda pode
  funcionar, mas o resultado vem como `warning` e deve ser corrigido no
  Builder.
- `bundles_with_issues` permite localizar os bundles que precisam de revisão.

Esta auditoria não faz correção automática. Depois de corrigir um bundle,
publicar pelo fluxo normal e executar o comando novamente.
