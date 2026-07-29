# FAQ e Orientações v3 — auditoria e piloto integrado

## Veredito

As Fases 0–5 estão implementadas no código e o piloto local automatizado está
verde. A afirmação é limitada ao que este ambiente consegue provar: não há Bench,
gcloud, site Frappe nem credenciais GCS/SMTP configuradas nesta máquina. O
workflow de homologação agora também constrói e implanta os processadores privados
de documentos e mídia, configura autenticação IAM entre serviços e usa o bucket
GCS montado pelo Cloud Run. O ensaio contra serviços reais continua sendo gate de
homologação, não uma evidência inventada.

## Evidência consolidada

| Camada | Resultado |
|---|---|
| Contratos puros backend do piloto | 25/25 |
| SSO Gateway | 17/17 |
| Contratos canônicos do CRM | 68/68 |
| E2E FAQ v3 e personas | 18/18 |
| E2E global do frontend | 29/29 |
| Contratos do deploy Cloud Run | 27/27 |
| Typecheck e ESLint | aprovados |
| Build de produção | aprovado |
| Imagem media processor | construída e iniciada |
| Imagem antimalware | construída e iniciada |
| Health e bloqueio sem token dos containers | aprovados |
| Sintaxe Bash e workflow YAML | aprovados |

Runner reproduzível:

```powershell
.\ops\smoke\faq-v3-local-pilot.ps1
```

## Auditoria por fase

| Fase | Requisito de encerramento | Evidência | Status |
|---|---|---|---|
| 0 | API institucional e consumo aluno/OP/público sem fallback local | checkpoint F0, wiring e personas | implementado |
| 1a | persistência, ETag, lifecycle, vigência, rollback | DocTypes, `knowledge_v3.py`, teste Frappe de lifecycle | implementado; executar no Bench |
| 1b | v2/v3, sticky, telemetria e lineage | runtime, Redis e E2E sticky | implementado |
| 1c | servidor como autoridade de rota | motor puro, preview/criação compartilhados | implementado |
| 1d | Biblioteca e Editor simplificados | E2E de criação/edição/prévia/playbooks | implementado |
| 1e | importação/migração com diff e órfãos | importador XLSX/JSON/procedure e testes | implementado |
| 2 | sugestões, grants e segregação de funções | APIs, DocTypes e E2E de quatro papéis | implementado |
| 3 | público sem SSO e documentos seguros | jornada pública, GCS privado, scanner e E2E | implementado; ativação depende de configuração |
| 4 | diretório, validação e e-mail correlacionado | import incremental, painel de fila humana, SLA, estados e ingress assinado | implementado; ensaio SMTP/Frappe pendente |
| 5 | mídia acessível e hardening | assets, conversor, validações e containers | implementado |

## Integração de homologação

- `crm-homolog-antimalware` e `crm-homolog-media-processor` são serviços
  privados, sem acesso anônimo.
- O service account do Frappe recebe `roles/run.invoker` somente nesses serviços.
- Cada chamada usa token IAM de identidade e segredo compartilhado armazenado no
  Secret Manager.
- O deploy do Frappe recebe os endpoints HTTPS, os segredos e
  `GCS_MOUNTED_STORAGE=true`; não depende de credenciais S3/HMAC para o volume
  GCS já montado.
- A credencial pública de upload é armazenada somente como hash e expira em 24
  horas por padrão (`PUBLIC_UPLOAD_TTL_HOURS`).
- O upload usa `Univesp Public Intake`: o protocolo só é criado depois da
  quarentena e a finalização é idempotente sob lock transacional.
- Preflight, release manifest e rollback incluem os dois serviços.
- O workflow permanece manual e protegido pelo ambiente `homolog`.

## Jornada `acesso-ava`

| Passo | Evidência automatizada/local | Gate em homolog |
|---|---|---|
| 1. Importar | E2E diff e migração idempotente | importar planilha piloto |
| 2. Editar | E2E editor, blocos e playbook | revisão visual |
| 3. Sugerir | API + E2E colaboração | OP autorizado real |
| 4. Aprovar | Gestor aprova; não publica | Gestor real |
| 5. Publicar | Admin vê ação apenas após aprovação | transação Frappe |
| 6. Iniciar jornada | aluno/público consomem publicado | API homolog |
| 7. Abrir atendimento | lineage sem fila do cliente | ticket Frappe |
| 8. Validar vínculo | 3 testes do classificador | Student Directory homolog |
| 9. Enviar documento | opcional/obrigatório e antimalware | GCS privado real |
| 10. Responder por e-mail | assinatura e adulteração testadas | SMTP + ingress real |
| 11. Escalar OP→BPO→Analista | catálogo/motor de rotas | filas e equipes homolog |
| 12. Publicar nova versão | lifecycle coberto no teste Frappe | publicação real |
| 13. Confirmar sticky | E2E e teste Redis/Frappe | duas sessões reais |
| 14. Executar rollback | contrato e teste Frappe | rollback real |
| 15. Arquivar/restaurar | API e biblioteca | ação Admin real |

## Auditoria dos pontos de produto

- A biblioteca opera com duas superfícies: Biblioteca e Editor.
- Não há “publicação avançada”, p50, prioridade numérica ou estados em inglês na
  superfície v3.
- “Prévia da jornada” substitui “Testar jornada”.
- Aluno/público, OP, BPO e Analista vivem no mesmo grafo versionado.
- BPO herda OP por campo; `null` herda e array vazio sobrescreve.
- Playbook inclui objetivo, checklist, sistemas, documentos, resposta, ações,
  escalonamento e resultados.
- Exclusão só é permitida para bundle nunca publicado; publicado é arquivado e
  pode ser restaurado.
- Documento pessoal só existe no nó final e segue `disabled`, `optional` ou
  `required`.
- CPF é `Password` no Frappe, só aparece por ação privilegiada auditada e não
  entra em logs/telemetria.
- A fila enviada pelo navegador não é autoridade.

## Teste final do usuário

O aceite visual e operacional precisa ser feito em um ambiente com as Fases 0–5
implantadas. Roteiro mínimo:

1. Como Admin, criar `acesso-ava-piloto`, importar a planilha e resolver o diff.
2. Editar uma orientação, um aviso e uma imagem com texto alternativo.
3. Criar playbook OP e sobrescrever um único campo do BPO.
4. Como OP autorizado, sugerir ajuste no atendimento.
5. Como Analista, incorporar; como Gestor, aprovar; como Admin, publicar.
6. Como visitante, percorrer a FAQ e abrir atendimento sem CPF em um fluxo que
   não o exige.
7. Repetir em fluxo que exige CPF e documento; confirmar bloqueio sem arquivo.
8. Como aluno sem SSO, validar vínculo e responder ao protocolo por e-mail.
9. Conferir OP→BPO→Analista e publicar uma segunda versão durante uma jornada já
   iniciada.
10. Confirmar sticky version, rollback, arquivamento e restauração.

Resultado esperado: nenhuma persona executa ação fora do seu escopo; a jornada
iniciada não muda de versão; o cliente nunca escolhe fila; publicado só muda por
aprovação/publicação auditadas.

## Comando de homologação

Após deploy e configuração:

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl "https://HOST_HOMOLOG" -IncludeIngress -IncludePwa
```

Esse smoke não substitui os dez passos de aceite visual acima.
