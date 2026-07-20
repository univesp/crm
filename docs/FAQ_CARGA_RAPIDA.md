# Carga rápida de FAQs por planilha

O FAQ Builder já possui importação XLSX por fluxo. Esse é o caminho recomendado
para carregar conteúdo em lote sem gravar linhas parcialmente inválidas.

## Pré-requisitos

- usuário com ação `edit_faq`;
- biblioteca institucional acessível em `/admin/faq`;
- filas/áreas responsáveis cadastradas;
- conteúdo revisado sem dados pessoais, segredos ou links internos restritos.

## Fluxo recomendado

1. Abra **Admin > FAQ Builder > Biblioteca**.
2. Crie um fluxo por assunto amplo, por exemplo “Matrícula” ou “Provas”.
3. Abra o fluxo e baixe **Template XLSX**.
4. Preencha uma linha para cada nó/pergunta/resposta.
5. Acesse o modo **Importação**, selecione a planilha e aguarde o dry-run.
6. Corrija todos os erros bloqueadores.
7. Clique em **Aplicar importação neste fluxo**.
8. Revise o canvas e salve como rascunho institucional.
9. Envie para revisão; publique somente após aprovação.
10. Confirme a resposta no portal de aluno ou no playbook do OP.

A importação é tudo-ou-nada e substitui o rascunho do fluxo aberto. Ela não
publica automaticamente.

## Estrutura mínima

| Coluna | Uso |
|---|---|
| `node_id` | identificador único e estável |
| `short_title` | pergunta ou rótulo exibido |
| `node_type` | `path` para navegação; `final` para resposta |
| `parent_id` | nó pai; vazio apenas para raiz |
| `response_content` | obrigatório para nó final |
| `closing_action` | ação ao concluir |
| `child_order` | ordem entre irmãos |
| `theme` / `subtheme` | classificação |
| `status` | use `draft` durante a carga |
| `queue_destination` | fila de atendimento |
| `criticality` / `sla` | criticidade e prazo |
| `bundle_owner_*` | responsável padrão do fluxo |

O template traz todas as colunas, exemplos e uma aba de instruções.

## Exemplo simples

| node_id | short_title | node_type | parent_id | response_content |
|---|---|---|---|---|
| matricula-raiz | Matrícula | path | | |
| matricula-prazo | Qual é o prazo? | final | matricula-raiz | Consulte o calendário acadêmico vigente. |
| matricula-docs | Quais documentos enviar? | final | matricula-raiz | Envie os documentos listados no edital vigente. |

Complete também fila, criticidade, SLA, ação e ownership usando os valores
válidos do template.

## Estratégia para volume

- separar por assunto, com um workbook por fluxo;
- carregar primeiro 5 a 10 fluxos prioritários;
- manter todos como rascunho;
- revisar links, datas, linguagem e responsável;
- publicar em lotes pequenos;
- testar aluno e OP após cada lote;
- usar identificadores estáveis para facilitar atualizações futuras.

Prioridade inicial sugerida:

1. matrícula/rematrícula;
2. calendário e provas;
3. acesso ao AVA;
4. documentos e declarações;
5. estágio/TCC;
6. bolsas e pagamentos;
7. atendimento do polo;
8. problemas de acesso e senha.

## Segurança e rollback de conteúdo

Antes de uma carga grande, a TI deve manter backup do DocType
`Univesp Knowledge Library` e do banco. O salvamento usa versão otimista:
se outra pessoa alterar a biblioteca, a API rejeita a escrita desatualizada.

Para desfazer:

1. não publique o lote com erro;
2. restaure o rascunho anterior ou o backup institucional;
3. se já publicado, arquive/corrija e gere nova versão;
4. valide novamente no portal.

Até existir segregação editorial completa, autor e aprovador devem ser pessoas
diferentes por procedimento operacional.