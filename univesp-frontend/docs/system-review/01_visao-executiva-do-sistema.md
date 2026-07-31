# Visao executiva do sistema

## Proposito do sistema

O produto e um CRM operacional-academico desenhado para reduzir atrito no atendimento em larga escala da UNIVESP, com foco em:

- reduzir abertura de protocolos desnecessarios
- qualificar o que chega na operacao
- padronizar decisao por conhecimento versionado
- dar visao gerencial acionavel para polos, areas e administracao central

**Evidencia:** [OBS] rotas e telas por perfil; [COD] `src/router.js`, `src/pages/*`, `src/services/*Runtime.js`.

## Problema institucional que resolve

Num cenario de alto volume (picos de 10k-20k protocolos), o risco operacional principal e:

- escalar tudo para area especialista
- perder rastreabilidade de decisao
- ter filas sem priorizacao objetiva
- manter conhecimento em texto solto e desatualizado

O sistema foi desenhado para quebrar esse padrao com triagem orientada, camada intermediaria forte, distribuicao por regra e governanca de conhecimento.

## Publico-alvo e cadeia de atendimento

Perfis contemplados no frontend atual:

- Aluno
- Orientador de Polo (OP)
- Gestor de Polos
- Analista de Area
- Gestor de Area
- Admin Central

Cadeia funcional desenhada:

1. Aluno tenta resolver via orientacao
2. Aluno abre protocolo somente quando necessario
3. OP trata o que e resolvivel na camada intermediaria
4. Casos complexos escalam para Area
5. Gestor de Area intervem em carga, escopo e excecao
6. Admin Central governa versao, parametros, permissoes e auditoria

## Premissas estruturais do produto

Premissas confirmadas no codigo:

- controle de acesso por perfil e acao em rota (`allowedProfiles`, `requiredActions`)
- modelo canonico para conhecimento, sugestao, publicacao, assignment, eventos e usage
- snapshots de conhecimento por caso para auditoria
- distribuicao baseada em elegibilidade + disponibilidade + carga + capacidade + SLA

**Evidencia:** [COD] `src/router.js`, `src/main.js`, `src/services/canonicalFoundationRuntime.js`, `src/services/distributionEngine.js`, `src/stores/studentSupport.js`.

## Diferencial da solucao

O diferencial nao e apenas visual: a base atual ja separa regras operacionais de apresentacao, incluindo:

- workflow canonico de versao de conhecimento (`Draft`, `In Review`, `Approved`, `Published`, `Archived`)
- workflow canonico de sugestao (`Pending Review`, `Approved`, `Rejected`, `Implemented`, `Superseded`)
- historico append-like de assignment e trilha de eventos
- governanca por perfil para aprovacao/publicacao/escopo

## Beneficios operacionais esperados

Se os contratos backend seguirem a fundacao atual:

- menor retrabalho de triagem
- menor escalonamento indevido
- maior consistencia de resposta ao aluno
- rastreabilidade por protocolo (quem decidiu, quando, com qual base)
- melhor capacidade de gestao de backlog, SLA e gargalo por assunto/area

## Ganhos institucionais estimados (visao de produto)

1. Reducao de volume improdutivo:
atendimento guiado reduz tickets mal categorizados e melhora qualidade de entrada.

2. Reducao de tempo de resposta:
distribuicao com elegibilidade/disponibilidade reduz fila parada por pessoa indisponivel.

3. Melhor governanca:
mudanca de FAQ/playbook passa por trilha de sugestao e aprovacao, com historico.

4. Maior prontidao para escala:
base modular e orientada a runtime/repositorio diminui retrabalho na transicao para Frappe.

## Leitura de maturidade atual

Estagio atual do sistema: **pre-homologacao funcional robusta em frontend mockado**, com boa fundacao canonica e risco ainda relevante em:

- dependencia de `Pinia + localStorage` como fonte de verdade
- ausencia de contratos API reais efetivamente integrados
- algumas rotas ainda mais demonstrativas (institucional/wireframe) do que operacionais

Resumo executivo:

- **forte para demonstracao e auditoria funcional**
- **bom para iniciar homologacao controlada**
- **ainda nao pronto para producao sem backend canonico e testes de integracao**

