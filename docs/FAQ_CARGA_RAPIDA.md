# Carga rápida de FAQs por XLSX ou JSON

O FAQ Builder aceita XLSX e JSON no modo **Importação**. Os dois executam dry-run, usam o mesmo validador canônico e sempre entram como rascunho; upload não publica automaticamente.

## Quando usar cada formato

- **XLSX**: curadoria em massa pela equipe de negócio.
- **JSON canônico**: integração, automação ou migração entre ambientes.
- **`procedure-capture-v1`**: transformar gravação de tela, voz, anotações e passos extraídos por ferramenta externa em rascunho revisável.

Vale manter a captura/análise de vídeo fora do CRM. O CRM recebe o resultado estruturado, valida e aplica revisão humana. Isso desacopla processamento pesado e evita acesso direto do capturador ao Frappe.

## Pré-requisitos

- usuário com ação `edit_faq`;
- biblioteca em `/admin/faq`;
- filas/áreas responsáveis cadastradas;
- conteúdo sem dados pessoais, segredos ou links internos restritos;
- mídia em origem HTTPS institucional compatível com o público da FAQ.

## Fluxo recomendado

1. Abra **Admin > FAQ Builder > Biblioteca** e crie/abra o fluxo.
2. Entre no modo **Importação**.
3. Selecione XLSX ou JSON; JSON tem limite de 2 MiB.
4. Aguarde o dry-run e corrija os bloqueios.
5. Aplique no fluxo aberto.
6. Revise texto, ordem, ownership, links, imagens, legendas e transcrição.
7. Salve como rascunho, envie à revisão e publique só após aprovação.
8. Confirme no portal do aluno e, quando aplicável, no playbook do OP.

A importação é tudo-ou-nada e substitui o rascunho do fluxo aberto.

## JSON canônico

O arquivo pode conter o bundle diretamente ou dentro de `generatedFaqBundle`/`bundle`:

```json
{
  "schema_version": "2.0.0",
  "faq_id": "acesso-ava",
  "tipo_faq": "aluno",
  "metadata": {
    "title": "Acesso ao AVA",
    "defaultOwnerType": "queue",
    "defaultOwnerId": "atendimento-geral"
  },
  "versioning": {"publication_status": "draft"},
  "nodes": [
    {
      "id": "acesso-ava-root",
      "node_kind": "path",
      "titulo_exibido": "Acesso ao AVA"
    },
    {
      "id": "acesso-ava-final",
      "node_kind": "final",
      "titulo_exibido": "Como recuperar o acesso?",
      "resposta": "Siga o procedimento institucional.",
      "media": [
        {
          "type": "image",
          "source_url": "https://conteudo.univesp.br/faq/ava/passo-1.png",
          "alt": "Tela de recuperação com o botão Continuar destacado",
          "caption": "Passo 1"
        }
      ]
    }
  ],
  "links": [
    {
      "link_id": "acesso-ava-link-1",
      "parent_node_id": "acesso-ava-root",
      "child_node_id": "acesso-ava-final",
      "ordem": 1,
      "ativo": true
    }
  ],
  "calendar_highlights": []
}
```

O importador força `tipo_faq` igual ao fluxo aberto, `publication_status=draft` e `import_source=json`.

## Contrato `procedure-capture-v1`

Uma ferramenta externa pode observar tela/voz/anotações, gerar passos e entregar. Um arquivo pronto para copiar e adaptar está em `docs/examples/procedure-capture-v1.json`:

```json
{
  "schema": "procedure-capture-v1",
  "procedure_id": "recuperar-senha-ava",
  "title": "Recuperar senha do AVA",
  "summary": "Procedimento validado pela equipe de acesso.",
  "owner": {"type": "queue", "id": "atendimento-geral"},
  "steps": [
    {
      "order": 1,
      "title": "Abra a recuperação de senha",
      "instruction": "Selecione Esqueci minha senha.",
      "notes": "Não informe credenciais na gravação.",
      "media": [
        {
          "type": "video",
          "source_url": "https://conteudo.univesp.br/faq/ava/recuperacao.mp4",
          "caption": "Demonstração completa",
          "transcript": "Abra o portal. Selecione Esqueci minha senha."
        }
      ]
    },
    {
      "order": 2,
      "title": "Confirme o e-mail",
      "instruction": "Use o e-mail institucional e conclua a validação."
    }
  ],
  "sources": [
    {
      "type": "image",
      "source_url": "https://conteudo.univesp.br/faq/ava/confirmacao.png",
      "alt": "Mensagem enviada ao e-mail institucional"
    }
  ]
}
```

A conversão gera uma FAQ linear com entrada e resposta final numerada. É um rascunho inicial, não aprovação automática da interpretação do vídeo.

## Mídia em respostas

Cada nó aceita até 8 itens em `media`.

| Campo | Regra |
|---|---|
| `type` | `image` ou `video` |
| `source_url` | HTTPS; caminho recomendado nesta versão |
| `asset_id` | identificador interno reservado |
| `alt` | obrigatório para imagem |
| `caption` | obrigatório para vídeo |
| `transcript` | recomendado; ausência gera aviso |
| `poster_url` | HTTPS opcional para vídeo |

HTTP, esquemas inseguros e mídia sem texto acessível bloqueiam importação/publicação. Imagens usam carregamento tardio; vídeos usam `preload=metadata`.

Para homologação imediata, publique arquivos no storage/CDN institucional por HTTPS. Upload binário interno e entrega por `asset_id` ainda exigem backend, antivírus, retenção, autorização e CDN.

## Planilha XLSX

No modo XLSX, baixe o template do editor. Uma linha representa cada nó; complete identificador, título, tipo, pai, resposta, ação, ordem, tema/subtema, fila, criticidade, SLA e ownership.

Para volume:

- um fluxo por assunto;
- começar pelos 5 a 10 assuntos prioritários;
- usar identificadores estáveis;
- publicar lotes pequenos;
- testar aluno e OP após cada lote.

Prioridades: matrícula/rematrícula, calendário/provas, AVA, documentos/declarações, estágio/TCC, bolsas/pagamentos, polo e acesso/senha.

## FAQ tipo `publico`

- Use `"tipo_faq": "publico"` no JSON canônico (candidato, ex-aluno, visitante).
- Seed de referência: `univesp-frontend/mocks/faq-publico.json`.
- Publicar no Admin FAQ Builder; consumo em `/publico` via `/api/public/v1/knowledge/faq-published`.

## Segurança e rollback editorial

Antes de carga grande, mantenha backup do `Univesp Knowledge Library` e banco. O salvamento usa versão otimista e rejeita escrita desatualizada.

Para desfazer: não publique lote com erro; restaure o rascunho/backup; se publicado, arquive/corrija e gere nova versão; valide novamente no portal. Autor e aprovador devem ser pessoas diferentes.
