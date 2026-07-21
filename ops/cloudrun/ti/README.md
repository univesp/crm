# Kit de ativação da homologação para a TI

Este diretório transforma o handoff em comandos verificáveis. Os checks são somente leitura por padrão: não criam contas humanas, não leem valores de secrets, não fazem deploy e não alteram tráfego.

Comece copiando `CHANGE_TICKET_TEMPLATE.md` para o sistema de chamados e preenchendo owners, SHA, backup, critérios de abort e evidências.

## Ordem de execução

1. Administrador GitHub configura o Environment `homolog`.
2. Administrador GCP verifica e concede apenas os quatro papéis faltantes.
3. Administradores Azure/SAML criam as quatro contas sintéticas.
4. TI configura `INITIAL_ADMIN_EMAIL` com a conta sintética administrativa.
5. Executa `Univesp Cloud Run Readiness`; somente prossegue se ficar verde.
6. Executa o deploy manual aprovado.
7. Faz os quatro logins, aprova os três perfis pendentes e roda smoke/negativos.
8. Arquiva evidências e remove os cookie jars.

## 1. Administrador GitHub

No Environment `homolog`:

- required reviewers e prevenção de self-review;
- branch permitida: `univesp/cloudrun-homolog`;
- owner e janela de mudança registrados;
- Variable `INITIAL_ADMIN_EMAIL` igual ao `subject_email` da conta `admin` do manifesto.

A conta atual recebe `403 Must have admin rights to Repository` ao administrar Environments; esta etapa exige administrador do repositório.

O workflow `Univesp Cloud Run Readiness` é diagnóstico. O workflow `Univesp Cloud Run Homolog` exige confirmação manual e aprovação do Environment.

## 2. Administrador GCP

Autenticar com uma conta autorizada a administrar IAM:

```bash
export GCP_PROJECT_ID=univesp-201808
export DEPLOYER_SERVICE_ACCOUNT=<valor-de-GCP_DEPLOYER_SERVICE_ACCOUNT>
export STATE_PATH=/caminho-do-ticket/iam-grants.json
```

Verificar sem alterar:

```bash
ACTION=check ./ops/cloudrun/ti/manage-deployer-iam.sh
```

Aplicar somente vínculos ausentes e gerar o manifesto de rollback:

```bash
ACTION=apply CONFIRM_IAM=homolog ./ops/cloudrun/ti/manage-deployer-iam.sh
```

Papéis limitados pelo script:

- `roles/cloudsql.client`;
- `roles/storage.bucketViewer`;
- `roles/vpcaccess.user`;
- `roles/compute.viewer`.

Guardar `STATE_PATH` no ticket/cofre operacional; ele não contém credenciais. Para remover somente vínculos adicionados pelo script:

```bash
ACTION=revoke CONFIRM_IAM_ROLLBACK=homolog ./ops/cloudrun/ti/manage-deployer-iam.sh
```

## 3. Contratos públicos dos IdPs

Valores já identificados na configuração atual:

| Contrato | Valor |
|---|---|
| Domínio | `https://homolog-crm.univesp.br` |
| Azure tenant | `99106079-5014-41d9-a528-f4a73e8b2d1e` |
| Azure admin client | `1af85e0d-b7d8-4bac-aa25-bc8e7bd673d6` |
| Azure acadêmico client | `d533ec8a-d1ed-4e83-8c75-f6cd67de4013` |
| Callback Azure | `https://homolog-crm.univesp.br/api/sso/azure/callback` |
| SAML SSO | `https://login.univesp.br/simplesaml/saml2/idp/SSOService.php` |
| SAML ACS | `https://homolog-crm.univesp.br/api/sso/saml/callback` |
| SAML Entity ID | `https://homolog-crm.univesp.br/saml/sp` |

Os IDs e URLs são públicos; secrets e certificado continuam somente no Secret Manager/GitHub Environment.

Validar redirects sem seguir a autenticação nem persistir `state`/`nonce`:

```bash
export PUBLIC_URL=https://homolog-crm.univesp.br
export AZURE_ADMIN_CLIENT_ID=1af85e0d-b7d8-4bac-aa25-bc8e7bd673d6
export AZURE_ADMIN_TENANT_ID=99106079-5014-41d9-a528-f4a73e8b2d1e
export AZURE_ACADEMICO_CLIENT_ID=d533ec8a-d1ed-4e83-8c75-f6cd67de4013
export AZURE_ACADEMICO_TENANT_ID=99106079-5014-41d9-a528-f4a73e8b2d1e
export SAML_IDP_SSO_URL=https://login.univesp.br/simplesaml/saml2/idp/SSOService.php
./ops/cloudrun/ti/verify-idp-redirects.sh
```

## 4. Contas sintéticas e perfis Frappe

Copiar `synthetic-accounts.example.json` para fora do repositório, preencher todos os `REPLACE_` e criar as quatro identidades nos IdPs. Não adicionar senha, token, cookie, client secret ou certificado ao JSON.

```bash
MANIFEST_PATH=/caminho-seguro/synthetic-accounts.homolog.json VALIDATION_MODE=runtime ./ops/cloudrun/ti/validate-synthetic-accounts.sh
```

Mapeamento obrigatório:

| Conta | IdP | Perfil Frappe | Escopo Frappe |
|---|---|---|---|
| `student` | Azure acadêmico ou SAML | `aluno` | `{}` |
| `operator` | Azure administrativo | `op` | `{"queues":["<fila>"]}` |
| `area` | Azure administrativo | `analista_area` | `{"areas":["<área>"]}` |
| `admin` | Azure administrativo | `admin_central` | `{}` |

Cada conta precisa de MFA, owner, expiração e escopo mínimo. O CRM não cria identidades no tenant.

O bootstrap usa `INITIAL_ADMIN_EMAIL` uma única vez: cria o perfil `admin_central` somente se não existir administrador ativo. Ele não promove um segundo usuário, não reativa perfil incompatível e não armazena senha. Após o deploy:

1. a conta `admin` entra pelo Azure administrativo;
2. `student`, `operator` e `area` fazem o primeiro login e geram solicitações pendentes;
3. o admin aprova cada solicitação com o perfil e os escopos da tabela;
4. cada usuário entra novamente antes do smoke.

Claims do IdP identificam o usuário, mas não substituem a aprovação do perfil de acesso no Frappe.

## 5. Readiness sem deploy

Executar `Univesp Cloud Run Readiness`. O artefato `homolog-readiness-<run>-<attempt>` contém:

- `preflight.json`: Cloud SQL, bucket, VPC, Artifact Registry, runtime SA e secrets habilitados;
- `initial-admin.json`: presença e domínio válido da configuração, sem expor o email;
- `idp-redirects.json`: redirects Azure/SAML sem nonce/state;
- `synthetic-template.json`: contrato das quatro contas;
- `summary.json` e `SHA256SUMS`.

Não executar deploy enquanto `summary.json.passed` não for `true`.

## 6. Deploy e smoke

Executar `Univesp Cloud Run Homolog` na branch `univesp/cloudrun-homolog` com `confirm_homolog_deploy=true`, `provision_infra=false`, aprovação do Environment e SHA/backup registrados.

Após os quatro logins, usar cookie jars somente em diretório temporário protegido:

```bash
export PUBLIC_URL=https://homolog-crm.univesp.br
export STUDENT_COOKIE_JAR=/caminho-temporario/student.cookies
export OP_COOKIE_JAR=/caminho-temporario/operator.cookies
export AREA_COOKIE_JAR=/caminho-temporario/area.cookies
export ADMIN_COOKIE_JAR=/caminho-temporario/admin.cookies
./ops/cloudrun/smoke-homolog.sh
```

Executar negativos de autorização, anexos/payload, claim concorrente, sessão Redis, worker/scheduler e observabilidade conforme `docs/TI_HOMOLOGACAO.md`. Nunca anexar cookies, senhas ou secrets ao artefato. Finalizar com `collect-homolog-evidence.sh` e remover os cookie jars.
