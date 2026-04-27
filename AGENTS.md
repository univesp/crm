# Sistema Polo / CRM UNIVESP - Instruções para agentes

## Contexto

Este projeto é um CRM acadêmico/institucional para atendimento de alunos, orientadores de polo, analistas de área, gestores e administradores.

O sistema deve ser simples, estável e guiado, considerando:
- escala próxima de 100k alunos;
- centenas de orientadores/secretários;
- picos de acesso simultâneo;
- usuários com diferentes níveis de letramento digital;
- grande volume de protocolos, anexos e fluxos operacionais.

## Prioridades

1. Estabilidade acima de refatoração estética.
2. UX simples e autoexplicativa.
3. Baixa carga cognitiva para aluno, OP, analista e gestor.
4. Separação clara entre perfil, permissão, status e SLA.
5. Não alterar regras de negócio sem explicar impacto.
6. Não alterar múltiplos módulos sem autorização explícita.
7. Evitar regressões em rotas, watchers, stores, runtime da FAQ e upload de anexos.

## Regras de segurança

1. Nunca versionar:

.env;
senhas;
tokens;
chaves de API;
CPF;
RA;
documentos de alunos;
planilhas reais sensíveis;
arquivos institucionais restritos.

## Estilo de implementação
Preferir alterações pequenas.
Preservar arquitetura existente.
Evitar reescrita total.
Documentar decisões técnicas relevantes.
Quando criar componentes novos, manter nomes claros.
Quando mexer em UX, considerar usuário não técnico.

## Antes de alterar código

O agente deve:
1. mapear arquivos envolvidos;
2. explicar causa provável;
3. propor patch mínimo;
4. listar riscos;
5. listar testes necessários;
6. aguardar confirmação quando a alteração for ampla.

## Validação esperada

Sempre que possível, rodar:

```bash
npm run build
npm run lint
npm run test