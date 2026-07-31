# Operacao do simulador e dos perfis de acesso

Este documento descreve a ativacao segura do simulador de Aluno/OP e dos perfis reutilizaveis. Ele complementa `docs/TI_HOMOLOGACAO.md`. Nao substitui a homologacao integrada nem a avaliacao institucional de LGPD.

## O que foi preparado

- Perfis de acesso reutilizaveis, grupos locais e atribuicoes com vigencia.
- Leitura compativel do perfil antigo: os seis perfis institucionais continuam sendo a base.
- Simulacao generica ou de pessoa real para Aluno e OP.
- Ator real preservado: o administrador nunca se transforma na pessoa consultada.
- Sessao opaca vinculada ao administrador, com 15 minutos de inatividade e limite de 60 minutos.
- Pesquisa de pessoa com no minimo tres caracteres e limite de 20 resultados.
- Bloqueio de escrita real no gateway e novamente no Frappe.
- Acoes de teste registradas somente no sandbox Redis, sem guardar mensagem ou arquivo enviado.
- Anexos expostos apenas como nome, tipo/tamanho e data; o gateway publico nao oferece download de arquivo.
- Auditoria de inicio da simulacao por referencia pseudonimizada, sem copiar nome, RA, e-mail, mensagens ou anexos para outra tabela.
- Health autenticado em `/api/app/v1/health`, com estados seguros de Frappe, banco e Redis.
- Flags independentes para desativacao imediata.

## Ordem obrigatoria de implantacao

1. Registrar SHA, imagens atuais, janela, responsavel e criterio de aborto.
2. Confirmar backup do Cloud SQL e owner do restore.
3. Construir frontend, gateway e Frappe a partir do mesmo SHA.
4. Implantar bootstrap/migracao antes de liberar trafego para a nova versao.
5. Executar `bench --site <site> migrate`.
6. Confirmar a criacao dos DocTypes:
   - `Univesp Permission Profile`;
   - `Univesp Access Group`;
   - `Univesp Permission Assignment`.
7. Confirmar que a patch `v0_2.seed_permission_profiles` foi executada.
8. Implantar gateway e web ainda com as duas flags desligadas.
9. Executar smoke de SSO, FAQ, filas, permissao negativa e health.
10. Habilitar primeiro perfis personalizados para um administrador piloto.
11. Cadastrar um grupo piloto e validar concessao e revogacao.
12. Habilitar o simulador somente depois dos negativos de autorizacao.
13. Manter o piloto restrito a contas sinteticas na primeira rodada.

A aplicacao nova nao deve receber trafego antes da migracao: o calculo de autorizacao consulta os novos DocTypes. As tabelas sao aditivas e o perfil antigo permanece disponivel para rollback de imagem.

## Flags de ativacao

O frontend e o gateway devem ser configurados em conjunto.

| Funcionalidade | Frontend, em build | Gateway, em runtime |
| --- | --- | --- |
| Simulador | `VITE_ENABLE_PRODUCTION_SIMULATOR=true` | `ENABLE_PRODUCTION_SIMULATOR=true` |
| Perfis e grupos | `VITE_ENABLE_CUSTOM_PERMISSION_PROFILES=true` | `ENABLE_CUSTOM_PERMISSION_PROFILES=true` |

Nos arquivos de producao do repositorio, as flags do frontend permanecem `false`. No gateway, flags ausentes ficam fechadas em producao. Alterar somente uma das duas camadas resulta em interface oculta ou resposta 404 controlada.

As flags nao sao segredos. Registre-as como variables do Environment `homolog`; nao use Secret Manager para esses dois valores.

## Dependencias que precisam estar saudaveis

- SSO Azure administrativo e academico, mais SAML quando aplicavel.
- `GATEWAY_REDIS_URL` privado e persistente.
- Redis de cache, fila e Socket.IO do Frappe.
- Cloud SQL acessivel pelo runtime.
- `UNIVESP_BFF_SHARED_SECRET` identico no gateway e no `site_config.json`.
- Conta tecnica Frappe restrita ao namespace institucional.
- Rota `/api/app/v1/*` enviada ao gateway.
- Mocks desligados no build: `VITE_ENABLE_MOCKS=false`.

Nenhum valor secreto deve ser colocado em issue, PR, screenshot, video ou log.

## Concessao do piloto

A patch adiciona ao perfil de sistema `admin_central` as capacidades:

- visualizar Aluno generico;
- visualizar Aluno real;
- visualizar OP generico;
- visualizar OP real;
- visualizar conteudo de anexo simulado;
- gerenciar perfis e grupos.

Para restringir o piloto, mantenha o simulador desligado ate criar um perfil personalizado com apenas as capacidades desejadas e atribui-lo ao grupo piloto. Perfis personalizados so somam capacidades quando o perfil base e compativel com a pessoa. Perfis institucionais protegidos nao podem ser alterados pela interface.

Na primeira rodada, nao conceder visualizacao de conteudo de anexo. O comportamento padrao mostra apenas metadados.

## Smoke obrigatorio

### Sem permissao

- O botao “Visualizar como” nao aparece.
- As APIs de simulacao retornam acesso negado ou funcionalidade indisponivel.
- Pesquisa direta de alvo nao enumera pessoas.
- Uma atribuicao de perfil base incompatível nao amplia o acesso.

### Simulacao generica

- Aluno mostra apenas conteudo publicado e nao encontra tickets pessoais.
- OP mostra somente as filas informadas no escopo.
- O banner permanece visivel em todas as capturas.
- A sessao expira por inatividade.

### Pessoa real

- A busca exige tres caracteres.
- O alvo precisa estar ativo e ter a persona solicitada.
- O que aparece corresponde ao escopo real do alvo.
- Um administrador nao consegue reutilizar a sessao opaca de outro.
- Trocar o identificador do alvo no navegador nao troca a pessoa aprovada pelo servidor.

### Escritas e anexos

- Criar protocolo, responder, anexar, publicar ou alterar estado nunca modifica Frappe durante a simulacao.
- Uma chamada direta com `X-Simulation-Session` para escrita recebe `SIMULATION_REAL_WRITE_BLOCKED`.
- A barreira Frappe tambem recusa metodos de escrita com contexto simulado assinado.
- O sandbox nao guarda o texto da resposta nem os bytes do anexo.
- Arquivos nao possuem URL de download na resposta institucional.

### Integracoes

- `/health` confirma a vida do gateway.
- `/api/app/v1/health`, com sessao, informa apenas `saudavel` ou `indisponivel` para Frappe, banco e Redis.
- Reiniciar uma instancia nao mistura simulacoes.
- Logout encerra a sessao do administrador e seu contexto de simulacao.

## Observabilidade

Alertar por:

- aumento de `SIMULATION_SESSION_INVALID` ou `SIMULATION_SESSION_EXPIRED`;
- qualquer `SIMULATION_REAL_WRITE_BLOCKED`, pois indica tentativa de escrita fora do sandbox esperado;
- falha do Redis ou do banco no health autenticado;
- HTTP 502 do gateway para Frappe;
- pesquisa excessiva de alvos ou respostas 429;
- uso do simulador fora do grupo piloto.

Correlacionar por `X-Request-ID`. Nao registrar corpo, e-mail pesquisado, RA, mensagem, nome de arquivo ou cabecalho de simulacao.

## Rollback

Rollback funcional imediato, sem restaurar banco:

1. Definir `ENABLE_PRODUCTION_SIMULATOR=false` no gateway.
2. Definir `ENABLE_CUSTOM_PERMISSION_PROFILES=false` no gateway.
3. Publicar frontend com as duas flags `VITE_*` em `false`.
4. Confirmar que o botao e as abas novas desapareceram.
5. Se necessario, retornar gateway e Frappe para as imagens anteriores por digest.
6. Executar smoke do perfil antigo.

As migrations nao sao revertidas. Os tres DocTypes e os registros semeados podem permanecer: sao aditivos e a versao anterior nao os consulta. Nao apagar tabelas para fazer rollback. Restore de banco somente em incidente de dados confirmado e com o owner definido.

## Limites desta entrega

A validacao local comprova contratos e barreiras no codigo. Ainda dependem do ambiente:

- migrate real em bench;
- Redis e Cloud SQL reais;
- IdPs e claims;
- teste por contas sinteticas;
- concorrencia entre instancias;
- carga e expiracao observada;
- alertas;
- rollback e restore exercitados;
- validacao do encarregado ou juridico.

Antes de ligar o simulador em producao, faltam dois itens de software:

- conectar as acoes das telas ao endpoint de sandbox para que responder, anexar, publicar, alterar estado e abrir protocolo tenham retorno simulado coerente; hoje a barreira segura bloqueia a escrita real, mas a experiencia interativa nao esta completa;
- separar o contexto sensivel em chaves Redis com TTL fisico maximo de 60 minutos; hoje o acesso vence logicamente em 15/60 minutos, mas a remocao fisica acompanha o TTL da sessao administrativa.
