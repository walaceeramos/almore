# Instruções para agentes de IA neste repositório

Leia este arquivo antes de qualquer alteração. Ele existe para manter a
consistência entre as etapas de desenvolvimento.

## O que é este projeto

Almore — plataforma web de gerenciamento de treino de força. Usada
principalmente no celular, dentro da academia, entre séries. Essa condição
de uso governa quase todas as decisões técnicas.

O planejamento técnico completo está em `docs/PLANEJAMENTO.md`. Se o arquivo
não existir, peça ao usuário antes de tomar decisões de arquitetura.

## Modo atual: dados no aparelho, sem banco e sem login

O usuário está decidindo se vai usar o Supabase. Enquanto isso, o app roda
**sem servidor de dados**: tudo fica no navegador do aparelho (IndexedDB,
via Dexie), com um único usuário local e sem login. Decisão do usuário,
com estes termos aprovados:

- Dados no aparelho, em `src/core/data/db.ts`. O app funciona sem internet.
- Sem login. O perfil (`profile`, id `"eu"`) substitui a conta; sem perfil
  concluído, `ProfileGate` manda para `/boas-vindas`.
- O código com Supabase está guardado no git: commit `0d400de`, tag
  `supabase-fase6`. As migrations continuam em `supabase/`, para referência
  e para a volta. Supabase, Drizzle e `postgres` saíram do `package.json`.
- Backup em arquivo (Ajustes → Exportar/Importar), porque o aparelho é a
  única cópia. O app pede ao navegador armazenamento persistente.

Quando o banco for decidido, ele entra como segunda implementação de
`core/data` ou como sincronização (Fase 9), sem reescrever telas nem regras.

## Estado atual

Fases 1 a 6 entregues e convertidas para dados no aparelho. A conversão
passou em typecheck, lint, testes e build, e todas as rotas respondem;
falta o usuário validar no navegador (criar perfil, programa, treino,
histórico e backup).

| Fase | Estado | O que entrega |
| --- | --- | --- |
| 1 | pronta | Fundação, perfil, layout, navegação, dashboard (login suspenso) |
| 2 | pronta | Catálogo de exercícios, busca, filtros, exercício personalizado |
| 3 | pronta | Criar, editar, duplicar e arquivar programas de treino |
| 4 | pronta | Execução do treino: registrar série, cronômetro, concluir |
| 5 | validar | Regras de domínio: progressão, recordes, 1RM, volume, consistência |
| 6 | validar | Histórico de sessões, com edição retroativa |
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
   biblioteca, mudança no formato dos dados guardados, volta do login ou
   escolha de banco.
4. **Ao terminar uma fase**, rode `npm run typecheck`, `npx eslint .`,
   `npm test` e `npm run build`, e relate: o que foi feito, arquivos criados
   ou alterados, o que funciona, pendências e como testar.

## Invariantes de arquitetura

- **`src/core/domain` é puro.** Não importa de `features`, de `app`, de
  `core/data` nem de biblioteca de UI. São funções testáveis isoladamente.
- **Uma feature não importa de outra feature.** Código comum sobe para
  `core` — por isso exercícios vistos de qualquer lugar moram em
  `core/data/exercises.ts`.
- **O banco do aparelho só existe no navegador.** Quem lê ou grava é
  componente cliente. Páginas (`page.tsx`) ficam como Server Components
  finos, só com `metadata`, e renderizam uma `view.tsx` cliente que lê com
  `useLiveQuery` — a tela se atualiza sozinha quando a tabela muda, sem
  `revalidatePath`. Página no servidor não importa `core/data/db`.
- **As travas que o Postgres dava viraram código.** Cascade, SET NULL,
  RESTRICT, unicidade (uma rotina ativa, uma sessão em andamento) e CHECK
  estão em `features/*/actions.ts`, sempre dentro de `db.transaction`, que
  aqui é atômica. Toda escrita em mais de uma tabela vai em transação.
- **Zod valida toda ação** antes de gravar.
- **Ação que navega devolve `redirectTo`**; a tela navega com
  `useRedirectOnSuccess`. Não chame `redirect()` dentro de ação.
- **Peso com duas casas.** Peso é número em JavaScript, mas todo valor
  gravado passa por `toKg` (centésimos), e as somas do domínio são feitas em
  centésimos inteiros. Anilhas de 1,25 kg acumulam erro em float.
- **Exclusão lógica (`archivedAt`) em exercícios personalizados e
  programas.** Apagar de verdade quebraria o histórico que aponta para eles.
- **Prescrição e execução são coisas distintas.** Um treino é plano; uma sessão
  é o que aconteceu. `sessionExercises` guarda snapshot da prescrição vigente,
  senão editar o programa reescreveria o passado.
- **Execução aponta para o plano com "SET NULL".** Apagar um dia ou uma
  prescrição zera `routineDayId`/`routineExerciseId` nas sessões, sem
  apagá-las (`removeDay`, `removeExercise`).
- **Id da série é gerado no cliente** (`core/utils/uuid.ts`) e gravado com
  `put`. Repetir o registro cai na mesma linha. A fila de sincronização da
  Fase 9 depende disso.
- **Exercício do catálogo tem o slug como id.** O catálogo vem dentro do app
  (`core/data/catalog.ts`, gerado por `scripts/gerar_seed.py`); o histórico
  aponta para o slug, então slug publicado não muda.
- **Mudar o formato dos dados = nova versão no Dexie** (`db.version(n+1)`),
  descrevendo só o que mudou, e `BACKUP_VERSION` acompanha. Nunca altere uma
  versão já publicada — é o equivalente a editar migration aplicada.

## Convenções

- Rotas, textos de interface e mensagens de erro em português do Brasil.
- Campos guardados em inglês, camelCase; a forma de cada tabela está em
  `core/data/types.ts`.
- Nomes de arquivos e variáveis em inglês; componentes de página podem usar
  português quando a rota é em português (`filtros.tsx` em `/exercicios`).
- Alvo de toque mínimo de 44 px. Campo de texto com `text-[16px]` para o iOS
  não dar zoom ao focar.

## Comandos

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm run typecheck   # checagem de tipos
npx eslint .        # lint
npm test            # testes de unidade de core/domain (Vitest, tests/unit)
python scripts/gerar_seed.py   # regera o catálogo (TS) e o seed SQL guardado
```

O app não precisa de `.env.local` neste modo.

## Banco guardado (Supabase)

Não está em uso. As migrations em `supabase/migrations` descrevem o modelo
equivalente e ficam para a volta ao banco. Ordem, se um dia forem
aplicadas: 0001, 0002, seed 0003, 0004, 0005, 0006, 0007, 0008. No banco
real só foram aplicadas até a 0006.

## Pendências conhecidas

- **Lentidão percebida na área de treinos.** As causas apontadas na Fase 6
  eram idas ao servidor (login repetido por página, consultas duplicadas,
  nenhuma tela de carregamento). Com os dados no aparelho, essas idas
  deixaram de existir e as telas mostram carregamento. Falta o usuário
  confirmar se a sensação de lentidão sumiu.
- **Animação de status do treino.** A ajustar.
- **`kg()` em `core/utils/format.ts` corta zero de número inteiro.**
  `kg(80)` devolve "8"; com string ("80.00") funciona. As telas passam
  `n.toFixed(2)`. Corrigir a função espera autorização (regra 1).
- **Sem teste automático da camada de dados.** As regras de domínio têm
  testes; as ações em `features/*/actions.ts` não, porque testar IndexedDB
  em Node exige `fake-indexeddb` (biblioteca nova, regra 3).

## Fase 6 — escopo entregue

`/historico` (calendário do mês, lista por dia, filtro por programa) e
`/historico/[sessaoId]` (correção de série, exercício, data, horário,
esforço, observação; exclusão do treino). Decisões aprovadas pelo usuário:

- Excluir treino concluído, em dois toques, recalculando os recordes.
- Data e horário editáveis, digitados no fuso do usuário
  (`zonedToUtc`). Mudar o início desloca as séries pelo mesmo tanto.
- Salva a cada alteração, sem botão de salvar tudo, como no editor.
- Remover exercício de treino antigo, com as séries, após confirmação.
- Filtro só por mês e programa; por exercício fica para a Fase 7.

Toda correção em treino concluído recalcula os recordes dos exercícios
afetados (`saveSet` e `deleteSet` verificam o status da sessão). Volume,
sequência, veredito e estagnação não precisam: são calculados na leitura.
Os campos de série (`components/set-fields.tsx`) são compartilhados entre
execução e histórico.

## Fase 5 — escopo entregue

Regras puras em `src/core/domain` (`progression`, `records`, `volume`,
`consistency`, `stagnation`), com testes em `tests/unit`. Toda regra nova
de domínio entra com teste. Tabela `personalRecords`. Decisões aprovadas
pelo usuário:

- Vitest como dependência de desenvolvimento.
- A primeira série de cada exercício vem pré-preenchida pela sugestão de
  progressão. Da segunda em diante, repete a última série de trabalho da
  sessão.
- Recordes são derivados: recalculados do zero, por exercício, ao concluir
  a sessão e a cada correção (`features/sessions/records.ts`). Durante o
  treino, a marca de recorde é calculada na tela.
- Série sem RIR anotado conta como dentro do RIR alvo.
- Peso corporal sem carga adicional: progressão só por repetições, fora dos
  recordes. Com carga adicional, conta a carga adicional.
- Semana começa na segunda. A semana atual só entra na sequência quando
  bate a meta, e não a quebra enquanto não acabou.
- Estagnação compara cada sessão com a imediatamente anterior, não com o
  recorde: quem volta de uma redução de carga está evoluindo.

## Fase 4 — escopo entregue

Tabelas `sessions`, `sessionExercises` e `sets`. Decisões aprovadas pelo
usuário:

- Sessão começa sempre de um dia de programa; exercício fora do plano pode
  ser acrescentado durante o treino (entra sem prescrição, alvos nulos).
- Uma sessão em andamento por vez.
- `weightKg` nulo = só o peso do corpo; preenchido em exercício de peso
  corporal = carga adicional.
- Descartar apaga de verdade, só em andamento.
- Superset ignorado: exercícios em sequência.
- Aviso do descanso com tela bloqueada fica para a Fase 9 (service worker).
  O término é guardado como instante, então o tempo está certo ao desbloquear.

Rotas: `/executar/[sessaoId]` e `/executar/[sessaoId]/resumo`, no grupo
`(execucao)`, fora de `(app)`, sem navegação. Iniciar fica no detalhe do
programa e no card "Treino de hoje" do início.

## Fase 3 — escopo entregue

Tabelas `routines`, `routineDays` e `routineExercises`. Telas de lista,
detalhe e editor de programa. O editor permite montar dias, adicionar
exercícios do catálogo, e definir por exercício: séries, faixa de
repetições, RIR alvo, descanso e ordem.

Critério de verificação: montar um programa de 5 dias do zero, sem erro.
