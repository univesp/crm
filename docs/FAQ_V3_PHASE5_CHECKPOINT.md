# FAQ e Orientações v3 — checkpoint da Fase 5

## Implementado

- Editor com blocos ordenáveis de texto, imagem, link, vídeo, aviso, botão
  controlado, arquivo institucional e animação.
- Identificadores estáveis por bloco e validação no backend antes da publicação.
- Renderização pública na ordem editorial, com texto alternativo, legenda e
  transcrição acessível.
- Upload editorial separado de documentos pessoais, protegido por permissão e
  pela flag `knowledge_media_upload`.
- Validação de MIME por assinatura real, limite de 25 MiB e antimalware antes do
  armazenamento.
- Conversão obrigatória de GIF para MP4 em serviço isolado, autenticado e com
  limites de duração, dimensão e tamanho.
- Novo DocType `Univesp Knowledge Asset`, com hash, metadados de acessibilidade,
  estado e proteção contra exclusão enquanto houver referência em uma versão.
- Links limitados a HTTPS ou `mailto`; scripts e ações arbitrárias são rejeitados.
- Rotas de assets protegidas por sessão no gateway e submetidas ao rate limit
  autenticado.
- Correção adicional da Fase 4: falha no envio SMTP não desfaz nem duplica a
  criação do protocolo; a confirmação é enfileirada após o commit.
- Runbook de storage, scanner e conversor atualizado.

## Testes e resultados

| Verificação | Resultado |
|---|---|
| Ruff dos arquivos da fase | aprovado |
| Testes Python de blocos, assinaturas, grafo e migração | 12/12 |
| Testes canônicos do frontend | 68/68 |
| Typecheck Vue/TypeScript | aprovado |
| ESLint | aprovado |
| Build Vite de produção | aprovado |
| E2E FAQ/editor/público/sticky/governança | 18/18 |
| Testes do SSO Gateway | 18/18 |
| Testes Playwright globais | 29/29 |
| Contratos do deploy Cloud Run | 34/34 |
| Axe WCAG 2/2.1 A e AA | sem violações críticas ou sérias na jornada pública com mídia |
| Navegação por teclado | seleção de tema e resposta validada com foco + Enter |
| Movimento reduzido | animações e transições desativadas quando solicitado |
| `git diff --check` | aprovado |

A suíte Playwright global foi saneada sem ignorar testes. O wiring institucional
que havia sido removido de Dashboard, Parâmetros, Pessoas/Acessos, Governança da
Área e detalhes OP/Área foi restaurado. Os 29 cenários passam em conjunto.

## Evidências funcionais

- O editor envia um PNG institucional, recebe `asset_id` e preserva a referência
  ao salvar o rascunho.
- A jornada pública renderiza aviso, imagem com `alt`, vídeo com legenda e
  transcrição.
- Documento obrigatório continua bloqueando a criação antes do protocolo.
- Sticky version, sugestão, aprovação e publicação permanecem sem regressão.
- Requisições anônimas para listar ou enviar assets recebem `401`.
- Arquivos com assinatura divergente do MIME são recusados.

## Riscos e pendências

- O workflow de homologação constrói e implanta ClamAV e o processador de mídia
  como serviços Cloud Run privados, usa IAM entre serviços e injeta os segredos
  pelo Secret Manager. O ambiente real ainda precisa executar o workflow e o
  smoke integrado antes de ativar as flags em produção.
- O bundle `exceljs` segue acima de 500 KiB. É aviso de performance da importação,
  não falha funcional ou de segurança desta fase.

## Teste do usuário

**Não precisa testar neste checkpoint.**

A experiência final será incluída no roteiro único do piloto integrado, após a
validação ponta a ponta do tema `acesso-ava`.

## Próxima fase

Validação integrada e piloto: executar a jornada completa, auditar os requisitos
das Fases 0–5 e preparar o roteiro final por persona.
