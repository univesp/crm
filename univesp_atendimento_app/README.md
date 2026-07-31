# UNIVESP Atendimento

App Frappe que implementa a fronteira de negocio do Atendimento UNIVESP sobre o
Frappe Helpdesk. O navegador nao chama este app diretamente: o SSO Gateway/BFF
valida a sessao institucional e encaminha uma identidade assinada.

Configuracao obrigatoria no `site_config.json`:

```json
{
  "univesp_bff_shared_secret": "valor-gerado-no-secret-manager"
}
```

O mesmo segredo deve existir apenas no SSO Gateway. Nunca deve ser publicado em
variavel `VITE_*` ou enviado ao navegador.
