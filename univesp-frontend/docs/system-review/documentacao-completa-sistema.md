# Documentacao completa do sistema

## 0) Referencia e evidencia

Escopo desta documentacao:

- frontend `univesp-frontend`
- analise funcional, operacional, UX e governanca
- revisao por codigo + observacao de telas + prints do pacote

Legenda:

- [OBS] observacao direta em tela/print
- [COD] confirmado por codigo
- [INF] inferencia plausivel

---

## 1) Visao executiva

O sistema e um CRM de atendimento academico para operacao em larga escala, com arquitetura por papeis:

- aluno
- orientador de polo
- gestor de polos
- analista de area
- gestor de area
- admin central

Proposta central:

1. guiar aluno antes de gerar protocolo
2. aumentar resolucao na camada intermediaria
3. escalar para area apenas quando necessario
4. garantir governanca e rastreabilidade de conhecimento e decisao
5. oferecer visao gerencial acionavel

Estagio atual:

- forte para homologacao funcional assistida
- ainda nao pronto para producao plena sem backend canonico

---

## 2) Visao funcional de alto nivel

Modulos identificados:

- autenticacao e acesso local
- institucional (blueprint)
- aluno
- OP/gestor de polos
- area (analista e gestor)
- admin central

Fundacao funcional confirmada:

- rotas com controle por perfil e acao
- estados canonicos de protocolo, assignment, disponibilidade e conhecimento
- fluxo de sugestao/revisao/publicacao
- trilha de eventos/routing/knowledge usage
- distribuicao automatica por elegibilidade/disponibilidade/carga/capacidade/SLA

---

## 3) Mapa de modulos (resumo)

### Aluno

- home simples, jornada de duvida, protocolo, acompanhamento.

### OP

- fila operacional, detalhe de caso, orientacao, abertura assistida em nome do aluno.

### Area

- fila especializada, detalhe com decisao guiada, orientacao, governanca e revisao de mudancas.

### Gestao/admin

- dashboard de operacao, FAQ builder, parametros SLA/criticidade, permissoes e publicacao.

### Institucional

- paginas de blueprint para alinhamento tecnico/funcional de integracao.

---

## 4) Perfis e permissoes

Modelo atual de acesso:

- validacao de sessao (`requiresAuth`)
- validacao de perfil (`allowedProfiles`)
- validacao de acao (`requiredActions`)

Segmentacao bem resolvida:

- aluno isolado da operacao
- gestor de area com capacidades extras sobre analista
- admin central com governanca global

Risco principal de sobreposicao:

- OP x gestor de polos (mesma experiencia, diferindo mais por escopo que por papel).

---

## 5) Fluxos ponta a ponta (resumo)

Fluxos cobertos:

1. aluno resolve duvida sem protocolo
2. aluno abre protocolo
3. aluno acompanha e complementa
4. OP opera fila e trata caso
5. OP abre atendimento assistido
6. analista de area decide e resolve
7. gestor de area supervisiona/intervem
8. sugestao -> revisao -> publicacao de conhecimento
9. distribuicao automatica
10. governanca admin de parametro e permissao

Principio operacional forte:

- resolver na camada atual sempre que possivel
- encaminhar como excecao justificada

---

## 6) Catalogo de telas (consolidado)

Telas principais mapeadas:

- Geral: acesso local, login
- Institucional: visao institucional, triagem, ticket, handoff, integracoes
- Aluno: home, jornada, solicitacoes, detalhe, protocolo, confirmacao
- OP/gestor de polos: fila, detalhe, orientacao, abertura assistida
- Area: home gestor, fila, detalhe, orientacao, mudancas, governanca
- Admin: dashboard, FAQ, parametros, permissoes, publicacao
- Wireframe: rota exploratoria do aluno

Observacao importante:

- estado de detalhe da area em branco foi observado em edge case de escopo/URL e registrado como risco.

---

## 7) Regras de negocio e logica operacional

Regras confirmadas:

- workflow canonico de conhecimento/sugestao
- distribuicao com filtros ativos e disponibilidade temporal
- assignment sem carga de itens concluidos
- permissao por perfil e acao na navegacao
- registro de eventos/routing/knowledge usage

Regras inferidas:

- priorizar resolucao local e reduzir escalonamento
- uso de KPI para intervencao gerencial

Hipoteses a validar:

- semantica final de prioridade em backend
- politicas de conflito e rollback em producao

---

## 8) Analise UX critica por perfil

### Aluno

- forte em simplicidade de entrada
- precisa consolidar linguagem de status para leigos

### OP

- boa jornada operacional
- risco de sobrecarga textual e escalonamento precoce sem regra dura

### Analista de area

- melhoria clara na hierarquia de acao
- ainda denso em texto e com edge case de tela vazia

### Gestor de area

- papel gerencial melhor separado
- precisa explicabilidade de impacto de mudancas

### Gestor de polos

- sobreposto ao OP (precisa camada gerencial mais propria)

### Admin

- completo e poderoso
- denso e tecnico para uso sem capacitacao

---

## 9) Lacunas e riscos para validacao

Bloqueadores potenciais:

1. abertura de caso da area em branco em cenario de escopo/URL
2. necessidade de regra obrigatoria para resposta final antes de conclusao
3. dependencia de estado local como verdade operacional

Riscos altos:

1. performance em volume alto sem paginacao backend
2. permissao/escopo ainda nao validado server-side
3. governanca administrativa sem rede de seguranca suficiente (simulacao/rollback)

Riscos medios:

1. nomenclatura inconsistente entre modulos
2. complexidade do editor de FAQ
3. sobreposicao de papel no gestor de polos

---

## 10) Checklist de revisao externa

Checklist recomendado (resumo):

- visao executiva e aderencia institucional
- coerencia funcional ponta a ponta
- UX operacional e seguranca de decisao
- robustez da modelagem canonica
- escalabilidade e governanca
- prontidao para evolucao Frappe

Arquivo detalhado:
[10_checklist-para-especialista.md](./10_checklist-para-especialista.md)

---

## 11) Conclusao consolidada

Leitura final:

- o sistema tem fundacao funcional e arquitetural acima da media de prototipos
- a estrategia de conhecimento, distribuicao e governanca esta bem encaminhada
- existem riscos reais de producao ligados a backend, edge cases e escala

Parecer tecnico pragmativo:

- **go para homologacao controlada**
- **no-go para producao plena sem fechar bloqueadores estruturais**

---

## 12) Anexo visual (prints)

Referencias completas:

- [00_indice-geral.md](./00_indice-geral.md)

Pastas:

- [assets/screens/aluno](./assets/screens/aluno/)
- [assets/screens/orientador](./assets/screens/orientador/)
- [assets/screens/analista](./assets/screens/analista/)
- [assets/screens/gestor](./assets/screens/gestor/)
- [assets/screens/admin](./assets/screens/admin/)
- [assets/screens/geral](./assets/screens/geral/)

