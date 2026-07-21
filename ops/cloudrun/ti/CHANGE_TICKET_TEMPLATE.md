# Modelo de ticket — ativação da homologação

Não anexar senhas, cookies, tokens, certificados ou valores de Secret Manager.

## Identificação

- Ticket:
- Janela (início/fim e fuso):
- Responsável técnico:
- Aprovador GitHub:
- Administrador GCP:
- Administrador Azure/SAML:
- Canal de incidente:
- SHA aprovado:
- Imagem Frappe anterior:
- Imagem gateway anterior:
- Backup Cloud SQL identificado:
- RTO/RPO aprovado:

## Gate 1 — governança

- [ ] Environment `homolog` com reviewers, branch permitida e self-review bloqueado.
- [ ] Branch/SHA conferidos.
- [ ] Variable `INITIAL_ADMIN_EMAIL` aponta para a conta sintética `admin`.
- [ ] Owner de rollback e owner de restore presentes na janela.
- [ ] Manifesto de IAM será guardado junto deste ticket.

## Gate 2 — IAM e infraestrutura

- [ ] `ACTION=check` executado antes da mudança.
- [ ] `ACTION=apply CONFIRM_IAM=homolog` executado por administrador GCP.
- [ ] `STATE_PATH` anexado ao ticket (não contém credenciais).
- [ ] Cloud SQL `pgsql17-prod` confirmado.
- [ ] Bucket `univesp-201808-crm-homolog-sites` confirmado.
- [ ] VPC connector `crm-homolog-connector` confirmado.
- [ ] Redis privado e três URLs Frappe confirmados.
- [ ] Quotas de Cloud Run, VPC, Cloud SQL e Artifact Registry verificadas.

## Gate 3 — IdPs e contas sintéticas

- [ ] Redirect Azure administrativo confirmado.
- [ ] Redirect Azure acadêmico confirmado.
- [ ] ACS/EntityID SAML confirmados.
- [ ] Certificado SAML com owner e data de expiração registrados.
- [ ] Conta `student` criada, MFA e expiração configurados.
- [ ] Conta `operator` criada, MFA e expiração configurados.
- [ ] Conta `area` criada, MFA e expiração configurados.
- [ ] Conta `admin` criada, MFA e expiração configurados.
- [ ] Perfil inicial `admin_central` será criado somente pelo bootstrap controlado.
- [ ] Perfis `aluno`, `op` e `analista_area` e seus escopos foram aprovados após o primeiro login.
- [ ] Manifesto validado com `VALIDATION_MODE=runtime`.
- [ ] Nenhuma credencial foi incluída no manifesto/ticket.

## Gate 4 — readiness e deploy

- [ ] Workflow `Univesp Cloud Run Readiness` verde.
- [ ] URL da execução:
- [ ] Artefato de readiness e `SHA256SUMS` anexados.
- [ ] `confirm_homolog_deploy=true`.
- [ ] `provision_infra=false`.
- [ ] URL da execução de deploy:
- [ ] Revisões e digests novos registrados.

## Gate 5 — smoke e autorização

- [ ] Smoke anônimo verde.
- [ ] Login/logout/expiração student verde.
- [ ] Login/logout/expiração operator verde.
- [ ] Login/logout/expiração area verde.
- [ ] Login/logout/expiração admin verde.
- [ ] Student não acessa ticket de outro aluno.
- [ ] Operator não acessa fila fora do escopo.
- [ ] Area não acessa ticket de outra área.
- [ ] Admin publica FAQ e portal consome a versão publicada.
- [ ] Anexo/payload inválido rejeitado.
- [ ] Claim concorrente testado.
- [ ] Cookie jars removidos após o smoke.

## Gate 6 — operação e observabilidade

- [ ] `X-Request-ID` correlacionado entre edge, gateway e Frappe.
- [ ] Erros 5xx e latência de web/gateway verificados.
- [ ] Instâncias, CPU, memória e cold starts de Cloud Run verificados.
- [ ] Conexões/erros de Cloud SQL verificados.
- [ ] Sessões Redis sobreviveram à troca de instância.
- [ ] Worker e scheduler processaram após reinício.
- [ ] Alertas e responsáveis confirmados.

## Restore drill separado

Não restaurar sobre a instância homolog durante a janela de deploy. Em janela própria:

- [ ] Restaurar o backup identificado em instância temporária.
- [ ] Confirmar integridade do site e migrations.
- [ ] Executar smoke somente na origem isolada.
- [ ] Medir RTO/RPO reais.
- [ ] Remover a instância temporária após aprovação e retenção das evidências.

## Critérios de abort e rollback

Abortar antes de alterar tráfego se readiness, backup, owners ou IdPs não estiverem confirmados.

Executar rollback de imagens se houver falha de login, regressão de autorização, 5xx persistente, worker/scheduler indisponível ou latência acima do limite aprovado. O rollback não desfaz migrations; incompatibilidade de schema exige forward-fix ou restore aprovado.

## Encerramento

- Resultado: aprovado / reprovado / rollback.
- Horário de encerramento:
- Evidência `homolog-evidence`:
- Manifestos pré/pós-rollback, se aplicável:
- Pendências e owners:
