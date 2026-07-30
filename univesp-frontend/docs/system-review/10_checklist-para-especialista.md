# Checklist para especialista externo

Use este checklist para revisar o sistema sem acesso inicial ao ambiente.

## Bloco A - visao executiva e aderencia institucional

- [ ] O problema institucional e grande o suficiente para justificar a solucao?
- [ ] A proposta de valor esta clara para cada perfil?
- [ ] A cadeia "aluno -> OP -> area -> gestor -> admin" esta coerente?
- [ ] O modelo evita escalonamento desnecessario?
- [ ] Ha leitura objetiva de ganhos operacionais esperados?

## Bloco B - coerencia funcional ponta a ponta

- [ ] Fluxo aluno (duvida, protocolo, acompanhamento) esta completo?
- [ ] Fluxo OP (fila, detalhe, orientacao, abertura assistida) esta consistente?
- [ ] Fluxo analista de area conduz para resolucao antes de excecao?
- [ ] Fluxo gestor de area diferencia supervisao de execucao?
- [ ] Fluxos de admin cobrem governanca real?

## Bloco C - qualidade de UX operacional

- [ ] Interfaces privilegiam decisao segura e nao apenas informacao?
- [ ] A carga cognitiva esta adequada para usuario nao tecnico?
- [ ] As acoes criticas tem hierarquia clara?
- [ ] Erros e estados vazios orientam recuperacao?
- [ ] Navegacao entre fila e detalhe e confiavel em todos os perfis?

## Bloco D - logica de negocio e governanca

- [ ] Regras de fila/prioridade/SLA estao explicitas?
- [ ] Escopo por perfil e acao esta bem segmentado?
- [ ] Regras de distribuicao automatica sao auditaveis e explicaveis?
- [ ] Excecao gerencial esta rastreavel?
- [ ] Conhecimento (FAQ/playbook) possui workflow real de melhoria e publicacao?

## Bloco E - modelagem e arquitetura

- [ ] Fundacao canonica cobre entidades criticas de operacao?
- [ ] Versao/publicacao de conhecimento esta imutavel por bundle?
- [ ] Usage/snapshot de conhecimento por caso esta confiavel?
- [ ] Assignment/routing/eventos estao aptos a auditoria?
- [ ] Existe caminho claro para migrao de `localStorage` para backend real?

## Bloco F - escalabilidade e operacao em volume

- [ ] Fila suporta crescimento para 10k-20k protocolos com paginacao server-side?
- [ ] Filtros e buscas estao prontos para consulta backend indexada?
- [ ] Estrategia de concorrencia para assignment foi considerada?
- [ ] KPIs gerenciais permanecem consistentes em alta carga?
- [ ] Existe estrategia de observabilidade e trilha de incidentes?

## Bloco G - seguranca operacional

- [ ] Acoes irreversiveis tem confirmacao e trilha?
- [ ] Permissoes criticas estao protegidas por backend (nao so front)?
- [ ] Concluir caso sem resposta final esta tecnicamente bloqueado?
- [ ] Redistribuicao e excecao tem justificativa obrigatoria?
- [ ] Auditoria atende requisito de responsabilizacao?

## Bloco H - prontidao para evolucao futura

- [ ] Base atual reduz retrabalho para integracao Frappe?
- [ ] Runtimes/repositorios estao preparados para troca de fonte de dados?
- [ ] Modulos estao coesos e sem acoplamento excessivo?
- [ ] Ha plano de transicao incremental para backend real?
- [ ] Existe backlog claro do que e bloqueador versus evolucao futura?

## Parecer sugerido no fechamento da auditoria

- [ ] Apto para demonstracao
- [ ] Apto para homologacao controlada
- [ ] Apto para producao restrita
- [ ] Apto para producao plena

Campos de justificativa para preenchimento do especialista:

- bloqueadores encontrados:
- riscos altos remanescentes:
- riscos medios aceitaveis:
- recomendacao final go/no-go:

