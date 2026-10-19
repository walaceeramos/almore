# Instruções para agentes de IA neste repositório

Leia este arquivo antes de qualquer alteração. Ele existe para manter a
consistência entre as etapas de desenvolvimento.

## O que é este projeto

Almore — plataforma web de gerenciamento de treino de força. Usada
principalmente no celular, dentro da academia, entre séries. Essa condição
de uso governa quase todas as decisões técnicas.

O planejamento técnico completo está em `docs/PLANEJAMENTO.md`. Se o arquivo
não existir, peça ao usuário antes de tomar decisões de arquitetura.

## Estado atual

Fases 1, 2 e 3 concluídas. Fase 3 validada contra o banco real (rotina
ativa exclusiva e isolamento entre contas nas três tabelas novas). Fase 4
implementada, aguardando validação contra o banco real (migration 0006).

| Fase | Estado | O que entrega |
| --- | --- | --- |
| 1 | pronta | Fundação, banco, autenticação, perfil, layout, navegação, dashboard |
| 2 | pronta | Catálogo de exercícios, busca, filtros, exercício personalizado |
| 3 | pronta | Criar, editar, duplicar e arquivar programas de treino |
| 4 | validar | Execução do treino: registrar série, cronômetro, concluir |
| 5 | — | Regras de domínio: progressão, recordes, 1RM, volume, consistência |
| 6 | — | Histórico de sessões, com edição retroativa |
| 7 | — | Gráficos de carga, volume e recordes |
| 8 | — | Metas, peso e medidas |
| 9 | — | Offline, fila de sincronização, PWA |
| 10 | — | Acessibilidade, desempenho, exportação, exclusão de conta |

## Regras que não podem ser quebradas

1. **Não remova nem altere funcionalidade já implementada** sem autorização
   explícita do usuário. Se achar que algo precisa mudar, explique primeiro
   e espere resposta.
2. **Uma fase por vez.** Não avance para a próxima automaticamente.
3. **Decisão que afeta todo o projeto exige confirmação antes.** Troca de
   biblioteca, mudança de schema existente, mudança de padrão de autenticação.
4. **Ao terminar uma fase**, rode `npm run typecheck`, `npx eslint .` e
   `npm run build`, e relate: o que foi feito, arquivos criados ou alterados,
   o que funciona, pendências e como testar.

## Invariantes de arquitetura

- **`src/core/domain` é puro.** Não importa de `features`, de `app` nem de
  biblioteca de UI. São funções testáveis isoladamente.
- **Uma feature não importa de outra feature.** Código comum sobe para `core`.
- **Drizzle serve APENAS para tipos TypeScript derivados do schema.** A
  fonte de verdade do banco são as migrations SQL escritas à mão em
  `supabase/migrations`, aplicadas manualmente no SQL Editor do Supabase.
  `schema.ts` precisa espelhar o SQL, mas nunca o gera nem o aplica.
- **O runtime lê via supabase-js.** O cliente Supabase carrega o JWT do
  usuário, que é o que faz o Row Level Security valer. Conexão direta por
  Drizzle usaria papel de serviço e passaria por cima do RLS.
- **Chave estrangeira apontando para `exercises` usa ON DELETE RESTRICT.**
  Vale para `routine_exercises`, `session_exercises` e qualquer outra que
  venha depois. A exclusão lógica por `archived_at` é a regra de produto;
  o RESTRICT é a trava no banco. Existe uma política de DELETE em
  `exercises` porque o rollback de `createCustomExercise` precisa remover
  um exercício órfão quando o vínculo muscular falha. Com RESTRICT, esse
  DELETE só funciona no caso órfão: o banco recusa apagar qualquer
  exercício já referenciado por histórico ou prescrição.
- **Resultado de consulta vem em snake_case; converta na borda.** O Postgres
  devolve `display_name`, o tipo do Drizzle é `displayName`. Toda query
  escreve um tipo de linha crua e uma função de conversão, como em
  `core/auth/session.ts` e `features/exercises/queries.ts`. Nunca castar o
  retorno direto para o tipo do Drizzle: o cast compila e devolve
  `undefined` em todo campo.
- **RLS ligado em toda tabela nova, sem exceção.** Política padrão nega tudo.
  Isso é redundante de propósito com o filtro da aplicação.
- **`getUser`, nunca `getSession`.** `getSession` confia no cookie sem validar
  o token no servidor.
- **Zod valida toda Server Action** antes de tocar o banco.
- **Peso em `numeric`, nunca em ponto flutuante.** Anilhas de 1,25 kg acumulam
  erro em `float`.
- **Exclusão lógica (`archived_at`) em exercícios e programas.** Apagar de
  verdade quebraria o histórico que aponta para eles.
- **Prescrição e execução são coisas distintas.** Um treino é plano; uma sessão
  é o que aconteceu. `session_exercises` guarda snapshot da prescrição vigente,
  senão editar o programa reescreveria o passado.
- **Execução aponta para o plano com ON DELETE SET NULL.** `workout_sessions`
  → `routines`/`routine_days` e `session_exercises` → `routine_exercises`.
  O editor apaga dias e prescrições de verdade; RESTRICT faria isso falhar
  depois do primeiro treino. A sessão não perde nada, porque o snapshot está
  nela. Para `exercises` continua RESTRICT.
- **Id da série é gerado no cliente** (`core/utils/uuid.ts`) e gravado por
  `upsert`. Repetir o registro cai na mesma linha. Não troque por id do
  servidor: a fila offline da Fase 9 depende disso.

## Convenções

- Rotas, textos de interface e mensagens de erro em português do Brasil.
- Nomes de tabelas e colunas em inglês, `snake_case`.
- Nomes de arquivos e variáveis em inglês; componentes de página podem usar
  português quando a rota é em português (`filtros.tsx` em `/exercicios`).
- Alvo de toque mínimo de 44 px. Campo de texto com `text-[16px]` para o iOS
  não dar zoom ao focar.
- Mensagens de erro do Supabase são traduzidas antes de chegar ao usuário.

## Comandos

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm run typecheck   # checagem de tipos
npx eslint .        # lint
python3 scripts/gerar_seed.py   # regera o seed de exercícios
```

## Banco

Rode no SQL Editor do Supabase, nesta ordem:

1. `supabase/migrations/0001_profiles.sql`
2. `supabase/migrations/0002_exercises.sql`
3. `supabase/seed/0003_exercises_seed.sql`
4. `supabase/migrations/0004_touch_updated_at_search_path.sql`
5. `supabase/migrations/0005_routines.sql`
6. `supabase/migrations/0006_sessions.sql`

Migrations novas seguem a numeração. Nunca edite uma migration já aplicada:
crie a próxima.

### Migrations: o SQL manda

Drizzle serve APENAS para tipos TypeScript derivados do schema. A fonte de
verdade do banco são as migrations SQL escritas à mão em
`supabase/migrations`, aplicadas manualmente no SQL Editor do Supabase.
`schema.ts` precisa espelhar o SQL, mas nunca o gera nem o aplica.

Por isso o projeto **não tem** `drizzle.config.ts` nem os scripts
`db:generate` e `db:push`. Foram removidos de propósito: o `out` do config
apontava para `supabase/migrations`, a mesma pasta das migrations escritas
à mão, e dois donos para a mesma pasta é bug esperando acontecer. Não
recrie nenhum dos dois.

O que mora no SQL e o `schema.ts` não declara: chaves estrangeiras,
todos os CHECK, índices parciais e funcionais, constraints como
`exercises_slug_scope`, políticas de RLS e triggers.

Ao criar uma tabela: escreva a migration SQL primeiro, aplique no SQL
Editor, depois espelhe as colunas no `schema.ts` — nunca o contrário.

## Pendências conhecidas

Registradas para não se perderem; nenhuma tem fase atribuída ainda.

- **Lentidão percebida na área de treinos.** A investigar: ainda não se
  sabe se vem de consulta, de renderização ou de navegação.
- **Animação de status do treino.** A ajustar.
- **`kg()` em `core/utils/format.ts` corta zero de número inteiro.**
  `kg(80)` devolve "8" e `kg(10)` devolve "1"; com string do `numeric`
  ("80.00") funciona. Afeta o "sobe X kg" do detalhe do programa quando o
  incremento é 10. A Fase 4 contorna com `toFixed(2)`. Corrigir a função
  espera autorização (regra 1).

## Fase 4 — escopo entregue

Tabelas `workout_sessions`, `session_exercises` e `sets`, com RLS
(migration 0006). Execução online, sem TanStack Query nem Dexie — entram
na Fase 9. Decisões aprovadas pelo usuário:

- Sessão começa sempre de um dia de programa; exercício fora do plano pode
  ser acrescentado durante o treino (entra sem prescrição, alvos nulos).
- Uma sessão em andamento por usuário (índice único parcial).
- Pré-preenchimento: última série de trabalho da sessão, senão a da última
  vez, senão fundo da faixa com carga zerada. Sugestão de progressão é Fase 5.
- `weight_kg` nulo = só o peso do corpo; preenchido em exercício de peso
  corporal = carga adicional.
- Descartar apaga de verdade, só em andamento (o RLS de DELETE garante).
- Superset ignorado: exercícios em sequência.
- Aviso do descanso com tela bloqueada fica para a Fase 9 (service worker).
  O término é guardado como instante, então o tempo está certo ao desbloquear.

Rotas: `/executar/[sessaoId]` e `/executar/[sessaoId]/resumo`, no grupo
`(execucao)`, fora de `(app)`, sem navegação. Iniciar fica no detalhe do
programa e no card "Treino de hoje" do início.

## Fase 3 — escopo entregue

Tabelas `routines`, `routine_days` e `routine_exercises`, com RLS. Telas de
lista, detalhe e editor de programa. O editor precisa permitir montar dias,
adicionar exercícios do catálogo, e definir por exercício: séries, faixa de
repetições, RIR alvo, descanso e ordem.

Critério de verificação: montar um programa de 5 dias do zero, sem erro.
