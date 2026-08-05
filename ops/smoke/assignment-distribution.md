# Smoke de distribuição de casos por área

Executar em homologação com uma área de teste e perfis internos fictícios,
antes de usar dados reais. O smoke deve registrar o resultado da função
server-side e não copiar dados de alunos para logs.

## Execução

No ambiente Frappe, chamar `resolve_area_assignment` para uma área com regra
conhecida, tema e assunto/subassunto de teste. Validar o dicionário retornado
e o registro de decisão criado pelo fluxo de tickets.

## Cenários mínimos

1. Automático: escolhe a pessoa elegível com menor carga ponderada.
2. Indisponível: não escolhe quem está indisponível; capacidade reduzida
   altera o peso da carga.
3. Fallback: sem analista elegível, escolhe gestor ativo da área.
4. Restrito: considera somente os perfis selecionados na regra.
5. Restrito sem pessoa apta: mantém o caso sem responsável, com alerta ao
   gestor, sem redistribuição silenciosa para outra pessoa.
6. Caso já assumido: não move automaticamente sem ação explícita.

Em cada resultado, conferir `distribution_mode`, `resolution_mode`,
`rule_id`, `profile_id` e, quando não houver responsável, `reason_code`.
Perfis devem ser identificados pelo ID estável; email e nome são apenas dados
de apresentação interna autorizada.
