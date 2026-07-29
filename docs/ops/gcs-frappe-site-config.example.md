# GCS — armazenamento privado Frappe

## Cloud Run homolog (modo canônico)

O deploy monta `SITES_BUCKET` no diretório do site Frappe e injeta:

```text
GCS_MOUNTED_STORAGE=true
GCS_BUCKET=<SITES_BUCKET>
```

Nesse modo, `private/files` é gravado no bucket montado e não exige credenciais
HMAC/S3 no `site_config`. O bucket não pode ter acesso público. A aplicação entrega
documentos somente pelo endpoint autenticado, com token de uso único e auditoria.

## VM/instalação sem volume GCS (compatibilidade S3)

Apos criar bucket `univesp-crm-attachments-homolog` no projeto `univesp-201808`:

```json
{
  "file_storage": "s3",
  "s3_bucket": "univesp-crm-attachments-homolog",
  "s3_key": "GOOGLE_ACCESS_KEY",
  "s3_secret": "GOOGLE_SECRET",
  "s3_endpoint_url": "https://storage.googleapis.com",
  "s3_signature_version": "s3v4",
  "antimalware_endpoint": "https://ANTIMALWARE_RUN_URL/scan",
  "antimalware_token": "SECRET_MANAGER_REFERENCE",
  "media_processor_endpoint": "https://MEDIA_PROCESSOR_RUN_URL/convert-gif",
  "media_processor_token": "SECRET_MANAGER_REFERENCE",
  "public_document_retention_days": 180
}
```

### Chaves esperadas

| Chave | Descricao |
|-------|-----------|
| `file_storage` | Deve ser `"s3"` (compat GCS) |
| `s3_bucket` | Nome do bucket |
| `s3_key` | HMAC access key da SA |
| `s3_secret` | HMAC secret da SA |
| `s3_endpoint_url` | `https://storage.googleapis.com` |
| `antimalware_endpoint` | Endpoint privado do scanner no Cloud Run |
| `antimalware_token` | Segredo compartilhado injetado pelo Secret Manager |
| `media_processor_endpoint` | Endpoint HTTPS `/convert-gif` do conversor de animações |
| `media_processor_token` | Segredo compartilhado exclusivo do conversor |
| `public_document_retention_days` | Retenção dos documentos públicos; padrão 180 dias |

Credenciais HMAC do GCS via Service Account (Interoperability). Montar SA JSON em `/run/secrets/gcs-sa.json` na VM — ver `env.vm.example` (`GCS_PROJECT`, `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`).

### Validação (sem bucket)

Na VM com bench:

```bash
chmod +x ops/vm/scripts/validate-gcs-site-config.sh
./ops/vm/scripts/validate-gcs-site-config.sh crm.localhost
```

Reporta chaves ausentes no `site_config` — util mesmo antes do bucket existir.

### Validação funcional

Upload de anexo no protocolo aluno; arquivo deve aparecer no bucket, nao no disco local.

Para a FAQ pública, a API falha fechada quando o bucket ou o antimalware não estão
configurados. O scanner deve responder JSON `{"status":"clean"}` apenas após analisar
o conteúdo; qualquer outra resposta mantém o arquivo fora do protocolo.

## Mídia editorial

O upload editorial usa o mesmo armazenamento institucional, mas arquivos publicados
na FAQ não são documentos pessoais. GIFs nunca são servidos diretamente: o app envia
o original já verificado pelo antimalware ao serviço em `ops/media-processor`, que:

- exige token privado;
- limita entrada e saída a 25 MiB;
- limita a animação a 30 segundos e 1920 px;
- remove áudio e converte para MP4;
- apaga os temporários ao final.

O MP4 convertido passa novamente pelo antimalware antes de ser salvo. Mantenha
`knowledge_media_upload=false` até storage, scanner e conversor estarem saudáveis.
