# Perfis e permissoes

## Fonte de verdade analisada

- [COD] `mocks/mockAccessProfiles.js`
- [COD] `src/services/mockContextRuntime.js`
- [COD] `src/router.js` (meta `allowedProfiles` e `requiredActions`)
- [COD] `src/main.js` (guard de autenticacao e autorizacao)
- [COD] `src/pages/admin/AdminPermissionsPage.vue`

## Perfis mapeados

1. aluno
2. op (orientador de polo)
3. gestor_polos
4. analista_area
5. gestor_area
6. admin_central

## Quadro de acesso por perfil

## Aluno

- Enxerga:
rotas `/aluno/*`.
- Pode fazer:
consultar orientacao, abrir protocolo, acompanhar status, responder complemento.
- Nao pode:
acessar fila operacional, governanca de area, paginas admin.
- Risco de confusao:
baixo.

## OP

- Enxerga:
`/op/fila`, `/op/fila/:caseId`, `/op/playbook`, `/op/novo-atendimento`.
- Pode fazer:
resposta inicial, solicitar complemento, escalonar quando necessario, abrir atendimento assistido.
- Escopo:
polos vinculados e filas visiveis do contexto.
- Risco de confusao:
medio em fronteira com gestor de polos se nao houver clareza de responsabilidade.

## Gestor de polos

- Enxerga:
mesmas rotas do OP.
- Pode fazer:
mesmas acoes de atendimento, com visao ampliada por multiplos polos.
- Diferencial real:
escopo, nao tela distinta.
- Risco:
sobreposicao de papel com OP em UX.

## Analista de area

- Enxerga:
`/area/fila`, `/area/fila/:caseId`, `/area/orientacao`.
- Pode fazer:
atuacao especializada no caso, pedir complemento, responder, concluir, encaminhar excepcionalmente.
- Escopo:
somente casos elegiveis por area/subassunto ou explicitamente atribuidos.
- Risco:
medio se elegibilidade real ficar apenas no frontend.

## Gestor de area

- Enxerga:
tudo do analista + `/area/operacao`, `/area/mudancas`, `/area/governanca`.
- Pode fazer:
intervencao gerencial (redistribuir, assumir excecao, revisar sugestoes, ajustar regras de escopo/disponibilidade).
- Diferencial:
camada gerencial e de governanca (nao apenas "analista com filtro").
- Risco:
medio se backlog/redistribuicao nao for suportado por backend canonicamente.

## Admin central

- Enxerga:
modulo institucional e `/admin/*`.
- Pode fazer:
dashboard executivo, editar FAQ, parametros, permissoes, publicacao/versionamento.
- Risco:
alto de sobrecarga funcional em uma unica persona se governanca nao for delegada por times.

## Permissoes por rota e acao (confirmado)

Padrao implementado:

- `allowedProfiles`: filtra perfil elegivel na rota
- `requiredActions`: filtra permissao funcional por acao
- `requiresAuth`: exige sessao

Exemplos:

- `/area/governanca` exige `gestor_area` + `manage_area_scope`
- `/area/mudancas` exige `gestor_area` + `approve_knowledge`
- `/admin/publicacao` exige `admin_central` + `publish_version`

## Diferencas de permissao bem resolvidas

- segregacao de aluno versus operacao/admin
- segregacao de analista versus gestor de area em paginas de governanca
- segregacao de admin para publicacao e parametros globais

## Onde ha risco de confusao ou sobreposicao

1. OP e gestor de polos compartilham quase toda a experiencia de tela.
Impacto: fronteira de responsabilidade menos clara.

2. Analista e gestor de area compartilham fila e detalhe.
Impacto: sem home gerencial forte, gestor pode operar como analista.

3. Escopo por permissao ainda depende de contexto mock para funcionar totalmente.
Impacto: risco de divergencia quando backend real entrar.

## Segmentacao atual: avaliacao

- Segmentacao por perfil:
**boa**
- Segmentacao por acao:
**boa**
- Segmentacao por dominio de dados real (backend):
**parcial**

## Pontos para validacao externa

- Matriz de acao cobre todas as operacoes criticas? (especialmente excecao e publicacao)
- Perfil gestor de polos precisa de camada gerencial propria?
- Escopo de analista em multiplas areas esta consistente em todos os endpoints futuros?
- Admin deve manter todas as alavancas ou parte vai para gestores de dominio?

