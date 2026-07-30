# Indice geral da revisao do sistema

## Sobre este pacote

Este pacote foi montado para analise externa sem acesso inicial ao sistema.
Todo o conteudo foi baseado em:

- observacao de telas reais no ambiente local (`http://localhost:8080/crm/acesso-local`)
- leitura de codigo-fonte (rotas, stores, runtimes, componentes, mocks e servicos)
- analise de documentacao existente no repositorio

Legenda de evidencia usada em todos os documentos:

- **[OBS]** observacao direta em tela/execucao local
- **[COD]** confirmado por leitura de codigo
- **[INF]** inferencia tecnica plausivel, ainda sem confirmacao de runtime ponta a ponta

## Documentos principais

1. [01_visao-executiva-do-sistema.md](./01_visao-executiva-do-sistema.md)
2. [02_visao-geral-funcional.md](./02_visao-geral-funcional.md)
3. [03_mapa-de-modulos.md](./03_mapa-de-modulos.md)
4. [04_perfis-e-permissoes.md](./04_perfis-e-permissoes.md)
5. [05_fluxos-completos.md](./05_fluxos-completos.md)
6. [06_catalogo-de-telas.md](./06_catalogo-de-telas.md)
7. [07_regras-de-negocio-e-logica-operacional.md](./07_regras-de-negocio-e-logica-operacional.md)
8. [08_ux-e-analise-critica.md](./08_ux-e-analise-critica.md)
9. [09_lacunas-riscos-e-pontos-para-validacao.md](./09_lacunas-riscos-e-pontos-para-validacao.md)
10. [10_checklist-para-especialista.md](./10_checklist-para-especialista.md)
11. [11_resumo-final.md](./11_resumo-final.md)
12. [documentacao-completa-sistema.md](./documentacao-completa-sistema.md)
13. [documentacao-completa-sistema.pdf](./documentacao-completa-sistema.pdf)

## Evidencias visuais (prints)

### Geral

- [assets/screens/geral/01-acesso-local.png](./assets/screens/geral/01-acesso-local.png)
- [assets/screens/geral/02-login.png](./assets/screens/geral/02-login.png)

### Aluno

- [assets/screens/aluno/01-home-aluno.png](./assets/screens/aluno/01-home-aluno.png)
- [assets/screens/aluno/02-jornada-duvida.png](./assets/screens/aluno/02-jornada-duvida.png)
- [assets/screens/aluno/03-minhas-solicitacoes.png](./assets/screens/aluno/03-minhas-solicitacoes.png)
- [assets/screens/aluno/04-detalhe-solicitacao.png](./assets/screens/aluno/04-detalhe-solicitacao.png)
- [assets/screens/aluno/05-abertura-protocolo.png](./assets/screens/aluno/05-abertura-protocolo.png)

### Orientador de polo e gestor de polos

- [assets/screens/orientador/01-fila-op.png](./assets/screens/orientador/01-fila-op.png)
- [assets/screens/orientador/02-detalhe-caso-op.png](./assets/screens/orientador/02-detalhe-caso-op.png)
- [assets/screens/orientador/03-consultar-orientacao-op.png](./assets/screens/orientador/03-consultar-orientacao-op.png)
- [assets/screens/orientador/04-abrir-atendimento-op.png](./assets/screens/orientador/04-abrir-atendimento-op.png)
- [assets/screens/orientador/05-fila-gestor-polos.png](./assets/screens/orientador/05-fila-gestor-polos.png)
- [assets/screens/orientador/06-detalhe-gestor-polos.png](./assets/screens/orientador/06-detalhe-gestor-polos.png)

### Analista de area

- [assets/screens/analista/01-fila-analista-area.png](./assets/screens/analista/01-fila-analista-area.png)
- [assets/screens/analista/02-detalhe-analista-area.png](./assets/screens/analista/02-detalhe-analista-area.png)
- [assets/screens/analista/03-detalhe-analista-vazio.png](./assets/screens/analista/03-detalhe-analista-vazio.png)
- [assets/screens/analista/04-conteudo-vigente-analista.png](./assets/screens/analista/04-conteudo-vigente-analista.png)

### Gestor de area

- [assets/screens/gestor/01-home-gestor-area.png](./assets/screens/gestor/01-home-gestor-area.png)
- [assets/screens/gestor/02-fila-gestor-area.png](./assets/screens/gestor/02-fila-gestor-area.png)
- [assets/screens/gestor/03-detalhe-gestor-area.png](./assets/screens/gestor/03-detalhe-gestor-area.png)
- [assets/screens/gestor/04-conteudo-vigente-gestor.png](./assets/screens/gestor/04-conteudo-vigente-gestor.png)
- [assets/screens/gestor/05-mudancas-pendentes-gestor.png](./assets/screens/gestor/05-mudancas-pendentes-gestor.png)
- [assets/screens/gestor/06-regras-operacionais-gestor.png](./assets/screens/gestor/06-regras-operacionais-gestor.png)

### Admin central e institucional

- [assets/screens/admin/01-dashboard-admin.png](./assets/screens/admin/01-dashboard-admin.png)
- [assets/screens/admin/02-faq-admin.png](./assets/screens/admin/02-faq-admin.png)
- [assets/screens/admin/03-parametros-admin.png](./assets/screens/admin/03-parametros-admin.png)
- [assets/screens/admin/04-permissoes-admin.png](./assets/screens/admin/04-permissoes-admin.png)
- [assets/screens/admin/05-publicacao-admin.png](./assets/screens/admin/05-publicacao-admin.png)
- [assets/screens/admin/06-visao-institucional-admin.png](./assets/screens/admin/06-visao-institucional-admin.png)
- [assets/screens/admin/07-triagem-admin.png](./assets/screens/admin/07-triagem-admin.png)
- [assets/screens/admin/08-ticket-admin.png](./assets/screens/admin/08-ticket-admin.png)
- [assets/screens/admin/09-handoff-admin.png](./assets/screens/admin/09-handoff-admin.png)
- [assets/screens/admin/10-integracoes-admin.png](./assets/screens/admin/10-integracoes-admin.png)

## Limitacao registrada

- Nao foi identificado print dedicado para as rotas abaixo; essas telas foram documentadas por codigo:
  - `/wireframes/aluno/:screenId?`
  - `/aluno/confirmacao/:protocolId`
