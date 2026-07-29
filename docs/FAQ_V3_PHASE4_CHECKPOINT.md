# FAQ v3 — checkpoint da Fase 4

## Resultado

O atendimento público consegue cruzar vínculo acadêmico sem revelar qual dado
divergiu, encaminhar casos inconclusivos para revisão humana e manter a conversa no
mesmo protocolo por e-mail.

## Entregas

- Student Directory com CPF criptografado e hash irreversível para busca.
- Patch de migração do CPF legado.
- Importação incremental e idempotente por hash da fonte.
- Registro de atualização da fonte e último processamento.
- Catálogos públicos sanitizados de curso e polo.
- Cruzamento de CPF, e-mail, RA, curso e polo.
- Resultados internos `verified`, `inconclusive`, `not_found`, `conflicting` e
  `unavailable`.
- Resposta pública genérica, sem indicar o campo divergente.
- Fila `Univesp Link Validation` com responsável lógico e SLA de 24 horas.
- Validação de vínculo não substitui a fila temática do protocolo.
- Confirmação por e-mail enviada pelo Frappe.
- `Reply-To` com token HMAC vinculado a protocolo e e-mail.
- Ingress autenticado de respostas.
- Correlação como `Communication` no protocolo existente.
- Idempotência por `Message-ID`.
- Remetente incompatível e protocolo adulterado rejeitados.
- Anexos de e-mail passam pelas mesmas regras de formato, antimalware e retenção.
- Runbook de configuração de e-mail e rotação de segredo.

## Validação executada

- Ruff: aprovado.
- Testes puros de vínculo e assinatura de e-mail: 5 aprovados.
- Typecheck e ESLint: aprovados.
- Playwright público: 4 cenários aprovados.
- Gateway: 17 testes aprovados.

## Riscos e pendências

- Testes integrados de `Communication`, envio SMTP e fila humana exigem Bench/Frappe.
- O provedor de e-mail deve normalizar o webhook no contrato documentado.
- A migração de CPF deve ser verificada em cópia de homolog antes de produção.
- Catálogos públicos dependem da carga inicial da Student Directory.

## Teste do usuário

**Necessário.**

1. Abrir atendimento com dados que confirmam o vínculo.
2. Usar um conjunto inconclusivo e confirmar criação na fila de validação.
3. Responder à confirmação por e-mail e conferir a `Communication`.
4. Reenviar o mesmo `Message-ID` e confirmar ausência de duplicidade.
5. Adulterar o protocolo no destinatário e confirmar rejeição.
6. Responder com anexo e conferir antimalware e vínculo ao protocolo original.

