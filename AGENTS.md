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

Fases 1 e 2 concluídas. Fase 3 é a próxima.

| Fase | Estado | O que entrega |
| --- | --- | --- |
| 1 | pronta | Fundação, banco, autenticação, perfil, layout, navegação, dashboard |
| 2 | pronta | Catálogo de exercícios, busca, filtros, exercício personalizado |
| 3 | próxima | Criar, editar, duplicar e arquivar programas de treino |
| 4 | — | Execução do treino: registrar série, cronômetro, concluir |
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
- **O SQL é a fonte de verdade do banco; o Drizzle serve só para tipos.**
  Veja "Migrations" abaixo. O runtime lê via supabase-js, porque o cliente
  Supabase carrega o JWT do usuário, que é o que faz o Row Level Security
  valer. Conexão direta por Drizzle usaria papel de serviço e passaria por
  cima do RLS.
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

Migrations novas seguem a numeração. Nunca edite uma migration já aplicada:
crie a próxima.

### Migrations: o SQL manda

As migrations são escritas à mão em `supabase/migrations/`. O Drizzle **não**
gera nem aplica nada neste projeto.

**Não rode `drizzle-kit generate` nem `drizzle-kit push`.** A pasta não é um
diretório de migrations válido do Drizzle: não existe `meta/_journal.json`, e
os arquivos `0001` e `0002` foram escritos à mão. `generate` produziria uma
migration recriando tudo do zero; `push` tentaria alinhar o banco ao
`schema.ts` e derrubaria o que só existe no SQL.

O que mora no SQL e o `schema.ts` não declara: chaves estrangeiras para
`auth.users`, todos os CHECK, índices parciais e funcionais, constraints
como `exercises_slug_scope`, políticas de RLS e triggers.

`src/core/db/schema.ts` existe para dar tipos ao TypeScript (`Profile`,
`Exercise`, ...). Ao criar uma tabela, escreva a migration SQL primeiro e
depois espelhe as colunas no `schema.ts`, sabendo que ele é um retrato
parcial — nunca o contrário.

## Fase 3 — o que vem agora

Tabelas `routines`, `routine_days` e `routine_exercises`, com RLS. Telas de
lista, detalhe e editor de programa. O editor precisa permitir montar dias,
adicionar exercícios do catálogo, e definir por exercício: séries, faixa de
repetições, RIR alvo, descanso e ordem.

Critério de verificação: montar um programa de 5 dias do zero, sem erro.
