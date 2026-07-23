# GCS — exemplo site_config Frappe (nao commitar credenciais)

Apos criar bucket `univesp-crm-attachments-homolog` no projeto `univesp-201808`:

```json
{
  "file_storage": "s3",
  "s3_bucket": "univesp-crm-attachments-homolog",
  "s3_key": "GOOGLE_ACCESS_KEY",
  "s3_secret": "GOOGLE_SECRET",
  "s3_endpoint_url": "https://storage.googleapis.com",
  "s3_signature_version": "s3v4"
}
```

Credenciais HMAC do GCS via Service Account (Interoperability). Montar SA JSON em `/run/secrets/gcs-sa.json` na VM — ver `env.vm.example`.

Validacao: upload de anexo no protocolo aluno; arquivo deve aparecer no bucket, nao no disco local.
