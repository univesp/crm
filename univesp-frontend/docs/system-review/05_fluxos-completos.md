# Fluxos completos ponta a ponta

## Metodologia

Cada fluxo abaixo segue o padrao solicitado:

- nome do fluxo
- perfil principal
- objetivo
- gatilho
- etapas
- decisoes
- excecoes
- saidas
- escalonamentos
- pontos fortes
- gargalos
- riscos operacionais
- riscos de UX
- pontos para validar

---

## Fluxo 1: aluno tenta resolver sem abrir protocolo

- Perfil principal:
aluno.
- Objetivo:
reduzir protocolos desnecessarios por orientacao guiada.
- Gatilho de entrada:
aluno acessa `/aluno` e escolhe "Tenho uma duvida".

### Etapas

1. Aluno entra na jornada (`/aluno/duvida`).
2. Seleciona assunto/subassunto em arvore.
3. Le resposta final do no.
4. Decide entre:
resolver com orientacao ou continuar para protocolo.

### Decisoes

- Se orientacao resolve:
encerra sem protocolo.
- Se nao resolve:
segue para `/aluno/protocolo`.

### Excecoes

- arvore sem no terminal util
- linguagem ambigua para usuario nao tecnico

### Saidas possiveis

- resolvido via FAQ
- continuidade para abertura de protocolo

### Escalonamentos

- indireto: vira protocolo e entra cadeia OP/area.

### Pontos fortes

- reduz carga de abertura desnecessaria
- mantem contexto da navegacao para o protocolo

### Gargalos

- profundidade de arvore pode cansar
- qualidade da resposta depende de governanca de conteudo

### Riscos operacionais

- conteudo desatualizado aumentar retrabalho

### Riscos de UX

- excesso de texto em no terminal

### Pontos para validar

- taxa de abandono na jornada
- taxa de "resolvido sem protocolo"

---

## Fluxo 2: aluno abre protocolo

- Perfil principal:
aluno.
- Objetivo:
formalizar caso quando FAQ nao resolve.
- Gatilho:
acao "continuar com solicitacao" apos jornada.

### Etapas

1. Tela de protocolo recebe contexto da jornada.
2. Aluno revisa resumo e anexa evidencias.
3. Sistema valida campos minimos.
4. Protocolo e submetido e gera confirmacao.

### Decisoes

- se faltam dados obrigatorios:
bloqueia envio e pede correcao.
- se valido:
gera protocolo.

### Excecoes

- anexos indisponiveis
- descricao insuficiente

### Saidas possiveis

- protocolo criado
- retorno para ajustes no formulario

### Escalonamentos

- protocolo segue para fila operacional.

### Pontos fortes

- contexto da duvida reaproveitado
- estrutura de validacao explicita

### Gargalos

- falta de feedback detalhado por campo em alguns cenarios de mock

### Riscos operacionais

- baixa qualidade de entrada se campos nao forem canonicos no backend

### Riscos UX

- confusao se aluno nao entender diferenca entre "enviar" e "acompanhar"

### Pontos para validar

- aderencia dos campos ao contrato Frappe final

---

## Fluxo 3: aluno acompanha solicitacao e responde complemento

- Perfil principal:
aluno.
- Objetivo:
evitar ruptura de comunicacao apos abertura.
- Gatilho:
acesso a `/aluno/solicitacoes` e detalhe `/aluno/solicitacoes/:protocolId`.

### Etapas

1. Aluno ve lista agrupada por status.
2. Entra no detalhe do protocolo.
3. Le proximo passo.
4. Se houver pendencia, envia complemento.

### Decisoes

- pendencia aberta:
mostrar CTA de resposta.
- sem pendencia:
modo consulta.

### Excecoes

- protocolo inexistente no escopo do aluno

### Saidas

- complemento enviado
- caso mantido em acompanhamento

### Escalonamentos

- resposta alimenta OP/area para retomada.

### Pontos fortes

- timeline e proximo passo reduzem ansiedade do aluno

### Gargalos

- sem backend real, estados podem divergir do comportamento futuro

### Riscos operacionais

- follow-up sem padronizacao gerar nova ida e volta

### Riscos UX

- status sem definicao simples pode confundir usuario leigo

### Pontos para validar

- nomenclatura de status para publico nao tecnico

---

## Fluxo 4: OP opera fila e trata caso

- Perfil principal:
orientador de polo.
- Objetivo:
resolver o maximo na camada intermediaria.
- Gatilho:
acesso a `/op/fila`.

### Etapas

1. OP filtra e prioriza casos.
2. Abre detalhe (`/op/fila/:caseId`).
3. Revisa resumo, historico e orientacao.
4. Escolhe acao:
responder, pedir complemento ou escalar.
5. Sistema registra evento e atualiza caso.

### Decisoes

- base suficiente:
responder.
- evidencia insuficiente:
pedir complemento.
- dependencia especializada:
escalar para area.

### Excecoes

- caso fora do escopo do polo
- caso ja encerrado

### Saidas

- resposta ao aluno
- solicitacao de complemento
- encaminhamento para area

### Escalonamentos

- para area conforme regras de roteamento/handoff.

### Pontos fortes

- fila e detalhe com foco operacional
- playbook consultavel durante atendimento

### Gargalos

- confiabilidade total depende de dados canonicos vindo do backend

### Riscos operacionais

- escalonamento precoce se criterio estiver frouxo

### Riscos UX

- excesso de informacao em alguns detalhes de caso

### Pontos para validar

- taxa real de resolucao no OP
- taxa de escalonamento por tema

---

## Fluxo 5: OP abre atendimento em nome do aluno

- Perfil principal:
OP.
- Objetivo:
assistir aluno quando ele nao consegue abrir sozinho.
- Gatilho:
rota `/op/novo-atendimento`.

### Etapas

1. OP identifica aluno (diretorio/manual).
2. Navega por assunto/subassunto.
3. Registra contexto validado.
4. Decide abertura, complemento ou escalonamento.
5. Confirma envio.

### Decisoes

- abrir novo caso
- pedir mais informacao
- escalar ja na abertura (se criterio fechado)

### Excecoes

- RA nao localizado
- assunto sem caminho claro

### Saidas

- caso criado com contexto estruturado

### Escalonamentos

- direto para fila/area conforme regra.

### Pontos fortes

- evita abertura informal fora do sistema

### Gargalos

- depende de boas regras de validacao para nao gerar ruído

### Riscos operacionais

- OP abrir caso indevido em nome do aluno sem lastro

### Riscos UX

- fluxo em multiplas etapas pode cansar sem autosave robusto

### Pontos para validar

- trilha de auditoria de "abertura assistida por terceiro"

---

## Fluxo 6: analista de area trabalha caso especializado

- Perfil principal:
analista de area.
- Objetivo:
resolver tecnicamente com apoio guiado.
- Gatilho:
`/area/fila` > abrir caso `/area/fila/:caseId`.

### Etapas

1. Analista escolhe area/escopo e abre caso.
2. Le resumo, contexto OP e historico.
3. Passa por bloco "Antes de decidir".
4. Consulta orientacao rapida da area.
5. Executa acao:
resposta final, complemento, conclusao interna ou excecao.

### Decisoes

- acao principal: responder
- secundaria: pedir complemento
- terciaria: concluir analise interna
- excepcional: encaminhar para outra area

### Excecoes

- caso atribuido para outro analista
- caso fora da area selecionada (pode gerar tela vazia se URL inconsistente)

### Saidas

- resposta ao aluno + OP
- complemento ao aluno + OP
- conclusao interna
- encaminhamento excepcional registrado

### Escalonamentos

- apenas no fluxo excepcional.

### Pontos fortes

- hierarquia de acao bem explicita
- reencaminhamento com motivo estruturado

### Gargalos

- alguns casos relatados com abertura em branco por mismatch de area na URL

### Riscos operacionais

- conclusao sem resposta final em contrato backend (precisa regra dura)

### Riscos UX

- carga textual ainda alta em trechos do detalhe

### Pontos para validar

- bloqueio tecnico de concluir sem resposta final ao aluno

---

## Fluxo 7: gestor de area supervisiona operacao e intervem

- Perfil principal:
gestor de area.
- Objetivo:
equilibrar carga, atacar gargalo e governar escopo.
- Gatilho:
acesso `/area/operacao`.

### Etapas

1. Le KPIs de backlog/risco/sem responsavel.
2. Abre fila ou caso critico.
3. Intervem em atribuicao, excecao ou reencaminhamento.
4. Ajusta regras operacionais (`/area/governanca`).
5. Revisa mudancas de conhecimento (`/area/mudancas`).

### Decisoes

- redistribuir caso
- assumir caso
- aprovar/rejeitar sugestao
- ajustar visibilidade e disponibilidade

### Excecoes

- excecao gerencial fora do fluxo padrao da FAQ

### Saidas

- operacao estabilizada
- governanca atualizada

### Escalonamentos

- para admin quando decisao excede area local.

### Pontos fortes

- separacao mais clara entre papel gerencial e papel executor

### Gargalos

- sem backend real, metricas podem nao refletir latencia/concorrencia reais

### Riscos operacionais

- intervencao manual excessiva se motor automatico nao for confiavel

### Riscos UX

- risco de dashboard ficar denso sem foco em acao

### Pontos para validar

- qualidade de sugestao de redistribuicao em volume real

---

## Fluxo 8: governanca de conhecimento (sugestao -> revisao -> publicacao)

- Perfil principal:
analista, gestor de area, admin.
- Objetivo:
evoluir FAQ/playbook com trilha auditavel.
- Gatilho:
analista identifica lacuna no conteudo.

### Etapas

1. Analista envia sugestao no modulo de orientacao.
2. Sugestao entra como `Pending Review`.
3. Gestor/admin revisa e decide.
4. Versao aprovada pode virar publicacao imutavel.
5. Casos passam a usar versao nova em usos futuros.

### Decisoes

- aprovar, rejeitar, implementar, superseder
- aprovar/publicar bundle version

### Excecoes

- sugestao duplicada
- conflito entre sugestoes simultaneas

### Saidas

- conteudo vigente atualizado com historico

### Escalonamentos

- admin central para publicacao global.

### Pontos fortes

- workflow canonico ja explicito

### Gargalos

- sem diff visual sofisticado

### Riscos operacionais

- publicar sem criterio claro de impacto

### Riscos UX

- editor admin ainda tecnico para usuario nao especialista

### Pontos para validar

- politica de aprovacao por area versus central

---

## Fluxo 9: distribuicao automatica de caso de area

- Perfil principal:
motor runtime + gestor/analista como consumidores.
- Objetivo:
atribuir caso de forma coerente com elegibilidade e disponibilidade.
- Gatilho:
caso entra em area sem responsavel.

### Etapas

1. filtra area responsavel
2. filtra assunto/subassunto elegivel
3. remove regras inativas
4. remove indisponiveis
5. pondera capacidade
6. calcula carga ativa
7. considera risco SLA
8. escolhe melhor candidato
9. registra scoreSummary e motivo

### Decisoes

- se nao houver candidato:
gera `unassigned_exception`.

### Excecoes

- indisponibilidade global sem area
- capacidade reduzida para todos elegiveis

### Saidas

- assignment automatico ou pendente sem responsavel

### Escalonamentos

- gestor pode sobrescrever manualmente.

### Pontos fortes

- criterio explicito, sem caixa preta

### Gargalos

- depende da qualidade do cadastro de disponibilidade e elegibilidade

### Riscos operacionais

- fairness ruim se carga ativa no backend nao estiver consistente

### Riscos UX

- explicabilidade da escolha precisa aparecer claramente para gestor

### Pontos para validar

- comportamento sob pico simultaneo e concorrencia real

---

## Fluxo 10: governanca admin de parametros e permissao

- Perfil principal:
admin central.
- Objetivo:
padronizar criticidade, SLA, escopo e trilha de mudanca.
- Gatilho:
acesso a `/admin/parametros` e `/admin/permissoes`.

### Etapas

1. admin revisa niveis oficiais
2. ajusta regra por tema/subtema/fila
3. visualiza impacto projetado
4. edita matriz de permissao
5. salva e gera log administrativo

### Decisoes

- nivel oficial
- regra ativa/inativa
- escopo por perfil

### Excecoes

- conflito entre regras
- escopo global excessivo

### Saidas

- governanca operacional ajustada

### Escalonamentos

- impacto desce para OP/area/aluno via runtime comum

### Pontos fortes

- painel com simulacao de impacto

### Gargalos

- necessidade de reconciliar essas regras com backend final

### Riscos operacionais

- erro administrativo afetar muitos casos ao mesmo tempo

### Riscos UX

- interfaces densas para administradores sem treino

### Pontos para validar

- modelo de rollback seguro por versao de parametro/permissao

