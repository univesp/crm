# Prontidão para homologação integrada

Este documento é a fonte de verdade do candidato acadêmico Cloud Run. Ele complementa `docs/TI_HOMOLOGACAO.md` e `ops/cloudrun/README.md`.

## Estado atual

| Camada | Estado | Evidência |
| --- | --- | --- |
| Código e contratos locais | Pronto para revisão | CI, testes de front door/gateway e scripts deste documento |
| VM interim (Fase A0) | Disponivel | `docker-compose.vm.yml`, `env.vm.example`, `ops/vm/bootstrap.sh` |
| PR acadêmica funcional | Candidata; sem deploy por esta mudança | PR base e checks do GitHub |
| Homologação integrada | Não comprovada | Depende de GCP, Redis, Cloud SQL e IdPs reais |
| Produção | Não recomendada | Depende da homologação, carga, observabilidade e restore exercitado |

Esta branch não executa deploy, migration, alteração de secret ou mudança de tráfego.

## Gates automatizados

O workflow manual `Univesp Cloud Run Homolog` executa:

1. validação das variáveis e dos valores secretos recebidos pelo job;
2. autenticação OIDC no Google Cloud;
3. preflight somente leitura de Artifact Registry, Cloud SQL, bucket, VPC connector, service account e versões habilitadas dos secrets;
4. build das imagens Frappe e SSO Gateway identificadas pelo SHA;
5. deploy do gateway, bootstrap e serviços Frappe;
6. smoke anônimo da fronteira pública;
7. manifesto de release com URL, revisão, imagem e tráfego de cada serviço;
8. upload das evidências JSON e checksums por 30 dias.

Os artefatos ficam no job como `homolog-evidence-<run>-<attempt>`. Nenhum script lê ou registra o valor de secrets.

## Gates sob responsabilidade da TI

Antes de disparar o workflow:

- configurar o Environment `homolog`, reviewers e branch permitida;
- cadastrar variables/secrets descritos em `docs/TI_HOMOLOGACAO.md`;
- confirmar callbacks Azure/SAML, claims e certificado;
- disponibilizar contas sintéticas de aluno, OP, área e admin;
- confirmar backup recente, owner do restore, RTO/RPO, janela e canal de incidente;
- registrar as imagens Frappe e gateway da última versão estável.

Depois do deploy:

- executar login, logout e expiração nos dois Azure e no SAML;
- fornecer cookie jars temporários para o smoke por perfil ou executar os mesmos checks manualmente;
- validar segregação/IDOR, anexos inválidos, claim concorrente, worker e scheduler;
- conferir logs, métricas, alertas e correlação por `X-Request-ID`;
- exercitar rollback de imagem e, em janela própria, restore.

## Execução local somente leitura

Com o SDK autenticado e as variáveis exportadas:

```bash
PREFLIGHT_MODE=gcp ./ops/cloudrun/preflight-homolog.sh

PUBLIC_URL=https://<dominio-homolog> \
  ./ops/cloudrun/smoke-homolog.sh

GCP_PROJECT_ID=<projeto> \
GCP_REGION=<regiao> \
  ./ops/cloudrun/release-manifest.sh
```

Para uma coleta única:

```bash
export PUBLIC_URL=https://<dominio-homolog>
export EVIDENCE_DIR=artifacts/homolog/manual-$(date -u +%Y%m%dT%H%M%SZ)
./ops/cloudrun/collect-homolog-evidence.sh
```

Cookies são opcionais e devem ser arquivos temporários protegidos:

```bash
export STUDENT_COOKIE_JAR=/caminho/seguro/student.cookies
export OP_COOKIE_JAR=/caminho/seguro/op.cookies
export AREA_COOKIE_JAR=/caminho/seguro/area.cookies
export ADMIN_COOKIE_JAR=/caminho/seguro/admin.cookies
./ops/cloudrun/smoke-homolog.sh
```

Não anexar cookie jars às evidências nem ao GitHub Actions.

## Rollback

O rollback cobre web, worker, scheduler e gateway. Exige imagens anteriores por digest SHA-256 ou tag hexadecimal de commit (7 a 64 caracteres) e confirmação explícita:

```bash
export GCP_PROJECT_ID=<projeto>
export GCP_REGION=<regiao>
export ROLLBACK_IMAGE_URI=<imagem-frappe-anterior-imutavel>
export ROLLBACK_GATEWAY_IMAGE_URI=<imagem-gateway-anterior-imutavel>
export CONFIRM_ROLLBACK=homolog
./ops/cloudrun/rollback.sh
```

O script cria manifestos pré e pós-rollback. Ele não desfaz migrations e não restaura dados.

## Critério de saída da homologação

A homologação só pode ser considerada aprovada quando os artefatos automatizados estiverem verdes e a TI anexar evidência dos gates por perfil, autorização negativa, observabilidade, rollback e restore. Até lá, o candidato permanece inadequado para produção.
