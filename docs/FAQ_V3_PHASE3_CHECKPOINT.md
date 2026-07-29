# FAQ v3 — checkpoint da Fase 3

## Resultado

A jornada pública começa pela FAQ anônima e só pede identificação quando a pessoa
abre atendimento a partir de uma resposta final. CPF, RA, curso, polo e documentos
são derivados da política publicada no nó; o navegador não define a política nem a
fila.

## Entregas

- Tela pública FAQ-first, responsiva e sem cadastro antecipado.
- Nome, e-mail, celular e vínculo solicitados na abertura.
- Vínculo `aluno` para quem não consegue usar o SSO.
- CPF opcional por padrão e obrigatório apenas com finalidade objetiva no fluxo.
- RA, curso e polo condicionais por resposta final.
- Editor configura política de identificação e bloqueia CPF sem justificativa.
- Documentos apenas em resposta final: desabilitado, opcional ou obrigatório.
- Sessão temporária de entrada antes do protocolo, com expiração padrão de 24 horas.
- Token opaco, curto e vinculado à sessão temporária para upload.
- Protocolo criado atomicamente somente após os documentos exigidos ficarem `clean`.
- Finalização idempotente: repetição válida devolve o mesmo protocolo.
- Extensão, MIME, assinatura binária e limite de 10 MiB validados no backend.
- Bucket privado obrigatório; falha fechada sem configuração GCS.
- Scanner ClamAV empacotado para Cloud Run.
- Arquivo é persistido privadamente na quarentena; somente `clean` pode ser ligado ao protocolo.
- Registro documental com hash, estado, datas e retenção.
- Descarte diário após o prazo configurado.
- Links de download autenticados, de uso único e com expiração de 5 minutos.
- Visualização de contato e download registrados em `Univesp Access Audit`.
- CPF em campo `Password`, mascarado no contexto e ausente de logs/telemetria.
- Backend continua ignorando fila enviada pelo cliente.
- Rate limit público preservado e limite adicional no upload.

## Validação executada

- Ruff no backend e scanner: aprovado.
- Typecheck Vue e ESLint focado: aprovados.
- Gateway: 17 testes aprovados.
- Build Vite de produção: aprovado, 453 módulos.
- Playwright público: 5 cenários aprovados:
  - FAQ pública sem CPF;
  - lineage sem fila escolhida pelo cliente;
  - CPF/RA condicionais com documento opcional;
  - documento obrigatório bloqueando antes da criação.
  - ordem intake → documento limpo → criação do protocolo.
- Regressão Editor/Biblioteca: 4 cenários aprovados.

## Riscos e pendências

- O teste Python integrado exige o ambiente Bench/Frappe; a máquina local não possui
  o pacote `frappe`.
- A validação real do bucket, do Cloud Run ClamAV e do campo `Password` exige aplicar
  `bench migrate` e configurar os segredos do ambiente.
- O scanner atual usa atualização de assinaturas durante o build da imagem. A rotina
  operacional deve reconstruir a imagem periodicamente para manter as assinaturas
  atualizadas.

## Teste do usuário

**Necessário.**

1. Visitante com dúvida geral: consultar FAQ e abrir atendimento sem CPF.
2. Aluno com problema de login: confirmar que CPF, RA, curso e polo aparecem apenas
   no fluxo configurado.
3. Resposta com documento opcional: abrir com e sem arquivo.
4. Resposta com documento obrigatório: confirmar bloqueio sem arquivo e sucesso com
   PDF, PNG ou JPG válido.
5. Como operador autorizado, revelar contato informando motivo e baixar o documento
   por link temporário.

## Correção de auditoria

O checkpoint anterior descrevia criação do protocolo antes do upload. Essa ordem
deixava protocolo órfão se o antimalware rejeitasse o arquivo. O contrato foi
corrigido para `Univesp Public Intake`: dados e arquivo permanecem temporários,
sessões abandonadas são descartadas por job e o `HD Ticket` só nasce na
finalização bem-sucedida.
