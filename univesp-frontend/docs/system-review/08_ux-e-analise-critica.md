# UX e analise critica por perfil

## Escopo

Analise focada em operacao real, clareza de decisao, risco de erro e consistencia entre fluxo e interface.

---

## 1) Aluno

## Clareza visual e entendimento do fluxo

- Ponto forte:
entrada do aluno e simples (duvida x solicitacoes).
- Ponto fraco:
status em alguns detalhes podem exigir alfabetizacao operacional maior do que o desejado.

## Coerencia entre acao e consequencia

- Bom:
jornada FAQ conduz para protocolo quando necessario.
- Fragil:
confirmacao e detalhe podem ficar abstratos sem linguagem mais direta de "o que acontece agora".

## Carga cognitiva

- Boa na home.
- Media na jornada quando arvore fica extensa.

## Prevencao de erro

- Validacao de formulario existe.
- Falta validar robustez de mensagens de erro de backend/rede.

## Consistencia

- Boa entre home, jornada e solicitacoes.
- Melhorar consistencia de termos: "solicitacao", "protocolo", "atendimento".

## Classificacao geral

- Maturidade UX aluno:
**boa para homologacao assistida**
- Ponto critico:
padronizar linguagem de status e proximo passo.

---

## 2) Orientador de polo (OP)

## Clareza visual e fluxo

- Ponto forte:
fila + detalhe + orientacao formam jornada operacional coerente.
- Ponto fraco:
detalhe pode ficar denso em alguns cenarios de contexto/historico.

## Senso de prioridade

- Bom:
chips, bucket e SLA ajudam.
- Risco:
sem disciplina de regra, pode escalar cedo demais.

## Prevencao de erro

- Parcial:
ha confirmacoes de acao, mas depende de texto livre em partes do fluxo.

## Aderencia a operacao

- Boa:
fluxo de abrir atendimento em nome do aluno e util para realidade de polo.

## Classificacao geral

- Maturidade UX OP:
**boa, com risco medio de sobrecarga textual e escalonamento prematuro**.

---

## 3) Analista de area

## Clareza visual e ordem cognitiva

- Melhorias relevantes ja implementadas:
bloco "Antes de decidir", hierarquia de acoes e rebaixamento de encaminhamento excepcional.
- Ainda pesado:
volume de texto no detalhe e muitas secoes consecutivas.

## Coerencia acao x consequencia

- Muito melhor:
acao principal e resolver/responder.
- Risco remanescente:
concluir analise interna sem garantias finais de resposta ao aluno em todos os cenarios.

## Carga cognitiva

- Media-alta:
tela informa bastante, mas ainda exige leitura longa.

## Prevencao de erro

- Boa para excecao:
encaminhamento exige motivo estruturado + area + contexto.
- Fraca em edge case:
tela vazia quando caso nao resolve corretamente na area da URL.

## Consistencia

- Boa entre fila e detalhe para acao principal.
- Ruim no estado de erro (sem feedback claro).

## Classificacao geral

- Maturidade UX analista:
**media-alta**
- Ponto critico:
estado de caso nao encontrado/fuera de escopo precisa tratamento explicito.

---

## 4) Gestor de area

## Clareza de papel gerencial

- Acerto:
home de operacao da area diferencia gestor do analista.
- Limite:
ainda compartilha boa parte da experiencia do analista no detalhe do caso.

## Leitura de operacao

- Bom:
KPIs de backlog, risco, sem responsavel e gargalo.
- Risco:
se dados de base nao forem canonicos no backend, painel vira "quase certo" e perde confianca.

## Capacidade de intervencao

- Boa:
regras operacionais e revisao de mudancas pendentes existem.
- Falta:
simulacao de impacto antes de alterar regra de escopo/disponibilidade.

## Classificacao geral

- Maturidade UX gestor de area:
**boa para homologacao funcional**
- Ponto critico:
explicabilidade dos impactos de governanca.

---

## 5) Gestor de polos

## Clareza de papel

- Fragil:
experiencia muito parecida com OP, principalmente na fila e detalhe.

## Risco operacional

- alto de papel sobreposto:
gestor pode operar igual atendente, com pouca camada de supervisao.

## Classificacao geral

- Maturidade UX gestor de polos:
**media**
- Prioridade de melhoria:
camada gerencial propria (visao multi-polo e distribuicao de carga).

---

## 6) Admin central

## Clareza visual

- Boa:
modulos de dashboard, FAQ, parametros, permissoes e publicacao estao separados.
- Desafio:
densidade alta de informacao e formulacao tecnica.

## Coerencia funcional

- Forte:
governanca esta conectada com runtime operacional.
- Risco:
excesso de alavancas sem trilhas de seguranca (simulacao, rollback, aprovacao em dupla).

## Consistencia

- Boa estrutura modular.
- Problema pontual:
strings com encoding inconsistente em algumas labels.

## Classificacao geral

- Maturidade UX admin:
**boa para equipe tecnica/gestao**
- Ponto critico:
evitar que tela de edicao vire gargalo de uso por nao especialistas.

---

## Leitura transversal de maturidade de design

## Pontos muito bons

- arquitetura de fluxo por perfil esta clara
- tentativa real de orientar decisao (nao so exibir informacao)
- governanca e operacao compartilham base de modelo

## Pontos medianos

- densidade textual em detalhes de caso
- consistencia de nomenclatura entre modulos
- sobreposicao OP x gestor_polos

## Pontos fracos

- estado de erro de algumas aberturas de caso sem feedback adequado
- dependencia de mock/local para verdade operacional
- ausencia de trilhas visuais de impacto antes de mudanca de regra critica

## Pontos criticos

1. caso em branco no detalhe da area (observado)
2. possibilidade de conclusao sem guarda de regra final consistente
3. escopo/permissao ainda nao validado ponta a ponta em backend real

