# Pacote de solicitacao para TI - CRM UNIVESP

Este documento consolida o que o time de TI precisa disponibilizar, decidir ou autorizar para acelerar a homologacao real do CRM e preparar a fase 2 de logica academica.

## 1. Acessos e repositorios

Disponibilizar:

- acesso SSH seguro na VPS de homologacao;
- usuario proprio para operacao do `frappe-bench`, com `sudo` controlado quando necessario;
- caminho do `frappe-bench`;
- nome do site Frappe, por exemplo `homolog.crm.univesp.br`;
- versoes instaladas de Frappe, Frappe CRM/ERPNext, Python, Node, MariaDB, Redis e Nginx;
- acesso de leitura aos logs de bench, workers, scheduler, Nginx, Redis e banco;
- repositorio Git do frontend;
- repositorio Git do app Frappe custom, se existir;
- repositorio Git do gateway SSO, se existir;
- branch de homologacao e regra de pull request;
- arquivos `.env.example` sem segredos reais.

Nao colocar em Git:

- senha de banco;
- client secret OAuth/Azure;
- chave privada SAML;
- API secret Frappe;
- certificado privado;
- backup com dados reais;
- `.env` real.

## 2. Infraestrutura minima

Definir e disponibilizar:

- dominio de homologacao e dominio de producao;
- certificado HTTPS valido;
- decisao se o frontend ficara em `/` ou `/crm`;
- subdominios/rotas para frontend, gateway SSO e Frappe;
- politica de CORS;
- politica de cookie entre dominios;
- health checks;
- backup e restore testado;
- logs estruturados;
- estrategia de rollback.

## 3. SSO e identidade

Disponibilizar ou autorizar:

- codigo do gateway SSO, se ja existir;
- endpoints `/api/me`, `/api/sso/start`, `/api/sso/logout` e callbacks Azure/SAML;
- metadata SAML/Azure sem segredo sensivel;
- nomes das variaveis de ambiente necessarias;
- definicao de cookie: dominio, `HttpOnly`, `Secure`, `SameSite`, expiracao;
- formato oficial do usuario autenticado.

Contrato minimo esperado para `/api/me`:

```json
{
  "id": "usuario-institucional",
  "email": "usuario@univesp.br",
  "displayName": "Nome do Usuario",
  "flow": "aluno|academico|admin",
  "profileKey": "aluno|op|gestor_polos|analista_area|gestor_area|admin_central",
  "roles": ["..."],
  "groups": ["..."],
  "student": {
    "ra": "0000000",
    "polo": "Guarulhos",
    "courseId": "licenciatura-matematica",
    "courseName": "Licenciatura em Matematica"
  },
  "operator": {
    "linkedPolos": ["Guarulhos"],
    "linkedAreas": ["Secretaria Academica"]
  },
  "expiresAt": "2026-06-19T18:00:00-03:00"
}
```

## 4. Decisao de banco de dados

Decisao recomendada para discutir com TI:

| Camada | Recomendacao | Motivo |
| --- | --- | --- |
| Core Frappe/CRM operacional | MariaDB | Caminho mais maduro e mais testado no ecossistema Frappe. |
| Cache, filas e realtime Frappe | Redis | Padrao operacional do Frappe. |
| Anexos de alunos | Google Cloud Storage | Reduz dependencia do disco da VPS e facilita escala/backup. |
| BI, relatorios, integracao institucional | PostgreSQL, se for padrao UNIVESP | Bom para analitico e integracoes, sem forcar o core Frappe a um caminho menos comum. |

PostgreSQL pode ser excelente como padrao institucional, mas para o core do Frappe a escolha deve considerar compatibilidade real da stack instalada, migrations, apps usados e suporte operacional. Se TI quiser PostgreSQL no core, a condicao minima e fazer uma prova tecnica com Frappe, apps instalados, migrations, permissao, relatorios, backup/restore e carga representativa antes da decisao.

## 5. Uploads de alunos

Cenario recomendado com Google Cloud:

- aluno envia arquivo pelo frontend autenticado;
- backend/Frappe valida sessao, protocolo, permissao, tipo, tamanho e quantidade;
- backend grava o arquivo no Google Cloud Storage;
- Frappe registra metadados no `File` ou DocType de anexo;
- download passa por endpoint autenticado ou URL assinada curta;
- auditoria registra upload, download, remocao e bloqueio.

Metadados minimos do anexo:

- protocolo/caso;
- aluno;
- nome original;
- MIME detectado;
- extensao;
- tamanho;
- hash;
- bucket/path;
- status de antivirus, quando houver;
- usuario que enviou;
- data/hora;
- visibilidade;
- politica de retencao.

Regras minimas:

- bloquear executaveis, HTML e SVG, salvo decisao explicita;
- limitar tamanho por arquivo;
- limitar quantidade por protocolo;
- validar permissao antes de download;
- evitar URL publica permanente;
- incluir arquivos no plano de backup/retencao LGPD.

## 6. Informacoes minimas de aluno para operar o MVP simples

Para atendimento simples, sem logica academica calculada, o minimo recomendado e:

- identificador institucional do usuario;
- e-mail institucional;
- nome de exibicao;
- RA ou identificador academico;
- polo atual;
- curso atual;
- status de vinculo simples: ativo, inativo, concluido, trancado ou indefinido;
- perfil de acesso: aluno;
- escopo LGPD/consentimento operacional quando aplicavel;
- protocolos do aluno;
- historico de interacoes do atendimento.

Para OP/area atuar com seguranca, cada protocolo precisa guardar:

- protocolo;
- aluno/RA;
- polo;
- curso, quando relevante;
- assunto/subassunto;
- origem;
- status;
- responsavel atual;
- fila/area;
- SLA;
- criticidade;
- eventos de auditoria;
- anexos vinculados;
- versao da FAQ/orientacao usada na abertura.

Organizacao recomendada:

- dados de identidade/sessao em `/api/me`;
- dados oficiais academicos em API/visao especifica, nao copiados livremente para o frontend;
- dados de atendimento no Frappe;
- dados sensiveis exibidos somente quando necessarios para a acao operacional;
- snapshots no protocolo apenas para rastreabilidade, mantendo fonte oficial separada.

## 7. Informacoes para preparar a fase 2 academica

Para responder perguntas como "quais disciplinas faltam cursar?", TI/dados academicos precisa disponibilizar:

- RA;
- curso;
- matriz curricular vigente do aluno;
- versao da matriz;
- historico de disciplinas cursadas;
- status de cada disciplina: aprovada, reprovada, cursando, dispensada, aproveitada, pendente;
- equivalencias e aproveitamentos;
- pre-requisitos, quando usados na regra;
- carga horaria obrigatoria e cumprida;
- componentes obrigatorios, optativos e complementares;
- regras de transicao de matriz;
- pendencias documentais que bloqueiam matricula/diploma;
- data de atualizacao da fonte.

Esses dados devem ser servidos por API oficial ou replica controlada. O CRM nao deve calcular com base em dados digitados pelo aluno.

## 8. Autorizacoes necessarias para eu implementar

Autorizar:

- criar app Frappe custom em homolog;
- criar/alterar DocTypes de CRM em homolog;
- criar endpoints `/api/method/univesp.api.*`;
- rodar migrations em homolog;
- criar fixtures de roles/permissoes;
- configurar variaveis sem acesso a segredos em texto aberto;
- integrar frontend com gateway/Frappe;
- criar testes de contrato;
- abrir branches e pull requests;
- acessar logs de homolog para diagnostico.

## 9. Sequencia sugerida

1. TI libera repositorios, VPS homolog e informacoes da instalacao.
2. TI confirma decisao de banco para core Frappe.
3. TI configura HTTPS, dominio e SSO em homolog.
4. Eu preparo app Frappe custom, DocTypes e endpoints iniciais.
5. Eu integro frontend por modulo, com fallback mock controlado.
6. TI valida seguranca, backup, logs e permissao.
7. Produto/TI rodam piloto restrito com poucos polos.
