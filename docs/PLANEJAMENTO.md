# Plataforma de Treinos — Planejamento Técnico

Sep 28, 2026

## Escopo e premissas

O produto é uma plataforma web de gerenciamento de treino de força, usada principalmente no celular, dentro da academia, entre séries. Essa condição de uso governa quase todas as decisões técnicas abaixo.

O que o contexto de uso impõe:

| Condição real | Consequência técnica |
| --- | --- |
| Sinal de celular ruim ou ausente na sala de musculação | A execução do treino precisa funcionar offline e sincronizar depois |
| Uso com uma mão, em 60–180 segundos de descanso | Alvos de toque grandes, poucos passos por registro, nada de formulário longo |
| Sessão dura 60–120 minutos com o app aberto | Estado local resiliente a recarregar a página, travar o navegador ou a bateria acabar |
| O dado registrado é a matéria-prima de tudo | Escrita nunca pode falhar silenciosamente; conflito precisa de regra explícita |
| Usuário único por conta, dados sensíveis de saúde | Isolamento por linha no banco, não apenas filtro na aplicação |

Premissas assumidas, sujeitas a correção:

- Um usuário gerencia apenas os próprios treinos. Papel de treinador gerenciando alunos fica fora da v1, mas o modelo de dados já deixa espaço.
- Português do Brasil, quilogramas, fuso America/Sao\_Paulo.
- Volume de dados por usuário é pequeno: algo entre 150 e 300 sessões por ano, dezenas de milhares de séries ao longo de anos. Nada aqui é problema de escala de dados; é problema de modelagem e de experiência.

## Decisões que travam o resto do projeto

Cinco decisões precisam de resposta antes da primeira linha de código. Cada uma muda arquitetura, não só implementação.

### 1. Onde o sistema roda

O app que já publiquei roda no runtime de artifacts da Claude. Ele tem banco de dados, mas não tem servidor próprio, autenticação própria, domínio próprio nem deploy independente. Um sistema com login, regras de negócio no servidor e persistência própria não cabe nele.

Para um projeto real existem dois caminhos:

|  | Caminho A — stack própria | Caminho B — continuar no artifact |
| --- | --- | --- |
| Hospedagem | Vercel + Supabase, conta sua | Claude, sem deploy |
| Autenticação | Real, multiusuário | Identidade da conta Claude |
| Domínio próprio | Sim | Não |
| Instalável como PWA | Sim | Limitado |
| Quem faz o deploy | Você, com meu passo a passo | Ninguém, já está no ar |
| Custo mensal | Zero nos planos gratuitos, até escalar | Zero |
| Serve para virar produto | Sim | Não |

O planejamento abaixo assume o **caminho A**. Eu escrevo todo o código, os schemas, as migrations e as instruções; você executa os comandos e conecta as contas. Não consigo fazer deploy por você.

### 2. Offline-first ou online-only

Offline-first é a decisão mais cara do projeto e a mais difícil de acrescentar depois. Ela obriga a ter identificadores gerados no cliente, fila de sincronização, resolução de conflito e uma camada local de dados.

Recomendo offline-first **apenas para a execução do treino**, que é onde a falta de sinal dói. O resto do app — histórico, gráficos, cadastro de exercícios, metas — pode ser online, o que reduz muito a complexidade. É um meio-termo defensável: o usuário nunca perde uma série registrada, e nós não pagamos o custo de sincronizar o sistema inteiro.

### 3. Banco de exercícios próprio ou aberto

Um app de treino precisa de algumas centenas de exercícios com grupo muscular, equipamento e padrão de movimento. Montar isso à mão é trabalhoso e é o tipo de dado que envelhece mal.

Proponho semear o banco com um conjunto curado de 150 a 200 exercícios que eu escrevo, em português, com classificação consistente, e permitir exercícios personalizados do usuário sobre essa base. Alternativa seria importar uma base aberta, que traz volume mas também tradução ruim e classificação inconsistente.

### 4. Onde vivem as regras de negócio

Cálculo de progressão, recorde pessoal, volume e consistência podem morar no cliente (rápido, funciona offline, mas duplicado e não confiável) ou no servidor (fonte única de verdade, auditável, mas exige rede).

Proponho: regras puras em um pacote TypeScript compartilhado, executadas no cliente para resposta imediata e **reexecutadas no servidor na sincronização**, que é quem grava o resultado final. O mesmo código roda nos dois lados, então não há duplicação de lógica.

### 5. Quem é o dono do treino prescrito

O Almore de hoje tem o programa fixo no código, escrito por mim. Num sistema real, o usuário cria e edita os próprios treinos. Isso é um produto diferente do que temos hoje.

Precisa ficar claro se a plataforma é uma ferramenta de autogestão, onde o usuário monta tudo, ou uma ferramenta de acompanhamento, onde alguém prescreve e o usuário executa. O modelo de dados abaixo suporta as duas, mas as telas e o fluxo mudam bastante.

## Arquitetura

&#91;embedded content: arquitetura em camadas · 4 camadas, núcleo compartilhado\]

O cliente calcula a progressão na hora, para responder em menos de 100 ms sem rede. O servidor reexecuta o mesmo código na sincronização e é quem grava o resultado final, então não existe lógica duplicada nem divergência entre os dois lados.

## Stack tecnológica

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Framework | Next.js 15, App Router | Server Components reduzem JavaScript no cliente, que importa em celular modesto na academia. Server Actions dão mutação tipada sem construir uma API REST inteira |
| Linguagem | TypeScript, modo estrito | Regras de progressão e recorde são onde erro de tipo vira dado errado no histórico |
| Estilo | Tailwind CSS 4 | Velocidade de iteração e bundle proporcional ao uso |
| Componentes | shadcn/ui sobre Radix | Código no seu repositório, não dependência opaca. Acessibilidade de teclado e leitor de tela já resolvida |
| Banco | PostgreSQL via Supabase | Relacional é o modelo certo aqui: séries pertencem a exercícios de sessão, que pertencem a sessões. Row Level Security isola por usuário no próprio banco |
| ORM | Drizzle | SQL explícito, migrations versionadas em arquivo, tipos derivados do schema. Prisma seria alternativa legítima, mais pesado no runtime |
| Autenticação | Supabase Auth | Integra com RLS: a política do banco lê o usuário do JWT. Evita a classe de bug em que o filtro fica só na aplicação |
| Estado de servidor | TanStack Query | Cache, revalidação e mutação otimista com rollback |
| Estado local offline | Dexie sobre IndexedDB | Fila de sincronização e sessão em andamento |
| Validação | Zod | Um schema serve borda da API, formulário e tipo TypeScript |
| Gráficos | Recharts | Suficiente para linha, barra e área. Leve, responsivo, sem licença paga |
| PWA | Serwist | Service worker mantido e compatível com App Router |
| Testes | Vitest e Playwright | Vitest cobre as regras de negócio puras, que é onde o risco está. Playwright cobre o fluxo de executar um treino inteiro |
| Hospedagem | Vercel | Deploy por push, preview por branch |

### O que foi descartado e por quê

- **React Native ou Flutter.** Você pediu web app. PWA instalável cobre o caso de uso sem loja de aplicativo, sem revisão da Apple e sem segunda base de código.
- **MongoDB ou Firestore.** Os dados são fortemente relacionais e as consultas de evolução envolvem agregação por exercício ao longo do tempo. SQL faz isso melhor e mais barato.
- **Backend separado em Node ou NestJS.** Duplicaria deploy, autenticação e tipos sem ganho nesta escala. Next.js com Server Actions já é o backend.
- **Redux ou Zustand como estado global.** A maior parte do estado é estado de servidor, que TanStack Query resolve melhor. Estado global real fica restrito à sessão de treino em andamento.

## Estrutura de pastas

Organização por funcionalidade, não por tipo de arquivo. Tudo que diz respeito a treino mora junto, o que torna o código fácil de achar e de remover.

```
app/
  (auth)/entrar, cadastrar, recuperar-senha
  (app)/
    layout.tsx                 casca autenticada: navegação, providers
    inicio/                    dashboard
    treinos/                   lista, [id], novo, [id]/editar
    executar/[sessaoId]/       modo execução, rota dedicada
    exercicios/                catálogo, [id], novo
    historico/                 lista, [sessaoId]
    progresso/                 cargas, volume, recordes
    metas/
    corpo/                     peso e medidas
    ajustes/
  api/sync/route.ts            endpoint de sincronização da fila offline
  manifest.ts, sw.ts

src/
  features/
    workouts/      components, hooks, actions, queries, schemas
    exercises/
    sessions/      inclui a máquina de estado da execução
    progress/
    goals/
    body/
    auth/
  core/
    domain/        regras puras, sem dependência de framework
      progression.ts    progressão dupla, sugestão de carga
      volume.ts         volume, tonelagem, séries por grupo
      records.ts        detecção de recorde e 1RM estimado
      consistency.ts    aderência, sequência, frequência
      units.ts
    db/            schema.ts, migrations, client, seed
    offline/       dexie.ts, queue.ts, sync.ts
    auth/
    utils/
  components/
    ui/            primitivos shadcn
    charts/
    layout/
  config/
  types/

tests/
  unit/            regras de domínio
  e2e/             fluxos completos
```

Duas regras de dependência que precisam ser respeitadas para o projeto não apodrecer:

1. `core/domain` não importa nada de `features`, `app` ou de biblioteca de UI. São funções puras, testáveis isoladamente, e é onde mora o valor real do sistema.
2. Uma feature não importa de outra feature. Se duas precisam do mesmo código, ele sobe para `core`.

## Modelo de dados

A distinção central do modelo é entre **prescrição** e **execução**. Um treino é um plano; uma sessão é o que realmente aconteceu. Confundir os dois é o erro de modelagem mais comum nesse tipo de app, e ele impede qualquer análise séria de progressão depois.

| Tabela | O que guarda | Relacionamentos |
| --- | --- | --- |
| `profiles` | Dados do usuário, preferências, unidade, fuso | 1:1 com `auth.users` |
| `exercises` | Catálogo. Semeados globais (`owner_id` nulo) e personalizados do usuário | N:1 opcional com `profiles`; N:N com `muscles` |
| `muscles` | Grupos musculares, tabela de referência | — |
| `exercise_muscles` | Grupo primário e secundários, com peso para contagem de volume | N:N entre `exercises` e `muscles` |
| `routines` | Programa de treino: nome, divisão, ativo ou arquivado | N:1 com `profiles` |
| `routine_days` | Dia dentro do programa: rótulo, ordem, dia da semana sugerido | N:1 com `routines` |
| `routine_exercises` | A prescrição: séries, faixa de repetições, RIR alvo, descanso, incremento, ordem, observação | N:1 com `routine_days` e com `exercises` |
| `workout_sessions` | Execução: data, início, fim, duração, status, nota, percepção de esforço | N:1 com `profiles`; N:1 opcional com `routine_days` |
| `session_exercises` | Exercício dentro da sessão, com ordem e o snapshot da prescrição vigente | N:1 com `workout_sessions` e com `exercises` |
| `sets` | A série: número, peso, repetições, RIR, tipo, concluída, registrada em | N:1 com `session_exercises` |
| `personal_records` | Recorde por exercício e tipo, com a série de origem | N:1 com `profiles`, `exercises` e `sets` |
| `goals` | Meta: tipo, alvo, prazo, progresso, status | N:1 com `profiles`; N:1 opcional com `exercises` |
| `body_metrics` | Peso e medidas, uma linha por data e tipo de medida | N:1 com `profiles` |
| `sync_queue` | Operações pendentes vindas do cliente offline | N:1 com `profiles` |

### Decisões de modelagem que merecem atenção

**Snapshot da prescrição na sessão.** `session_exercises` copia séries, faixa e RIR alvo no momento da execução. Sem isso, editar o programa reescreveria o passado: um treino feito em janeiro passaria a exibir a prescrição de junho, e toda a análise histórica ficaria errada.

**Série é linha, não JSON.** Guardar as séries como array em coluna JSON é tentador e rápido. Mas praticamente toda consulta interessante — melhor série, evolução de carga, volume por grupo — opera no nível da série. Linha separada permite índice e agregação em SQL.

**Peso em `numeric(6,2)`, nunca em ponto flutuante.** Anilhas de 1,25 kg e incrementos fracionados acumulam erro em `float`.

**Identificadores UUID gerados no cliente.** Obrigatório para offline: a série precisa ter identidade antes de existir no servidor, e a sincronização precisa ser idempotente.

**Exclusão lógica em `routines` e `exercises`.** Apagar de verdade quebraria o histórico que aponta para eles. Coluna `archived_at` em vez de `DELETE`.

**Registro de volume não é tabela.** Volume por grupo muscular é derivado de `sets` cruzado com `exercise_muscles`. Materializar isso seria duplicar verdade. Se a consulta ficar lenta, a solução é uma view materializada com refresh, não uma tabela mantida à mão.

## Autenticação e segurança

### Autenticação

Supabase Auth com e-mail e senha, mais login pelo Google. Sessão em cookie `httpOnly`, com refresh no middleware do Next.js. Confirmação de e-mail obrigatória e recuperação de senha por link com expiração.

O middleware protege o grupo de rotas `(app)` inteiro: sem sessão válida, redireciona para o login. Na volta, retoma a rota pretendida.

### Autorização

Row Level Security ligado em **todas** as tabelas, sem exceção. A política padrão é negar tudo; cada tabela ganha política explícita comparando `auth.uid()` com a coluna de dono, direta ou por junção.

Isso é deliberadamente redundante com o filtro da aplicação. Se um dia alguém esquecer um `where user_id = ...` numa consulta, o banco recusa mesmo assim. Segurança que depende de o desenvolvedor lembrar não é segurança.

O catálogo global de exercícios é a única exceção de leitura: `owner_id is null` é legível por qualquer usuário autenticado, mas gravável apenas por administrador.

### Outras camadas

| Risco | Tratamento |
| --- | --- |
| Entrada inválida ou maliciosa | Zod valida em toda Server Action, antes de tocar o banco |
| Chave de serviço vazando para o cliente | Apenas `NEXT_PUBLIC_*` vai ao bundle; `service_role` nunca sai do servidor |
| Força bruta em login e sincronização | Rate limit por IP e por usuário |
| Cabeçalhos e CSP | Definidos em `next.config`, com CSP restritiva |
| Dados de saúde sob LGPD | Exportação e exclusão de conta disponíveis ao usuário; retenção declarada na política de privacidade |
| Sincronização replicada ou fora de ordem | Idempotência por identificador de operação; servidor ignora operação já aplicada |

## Regras de negócio

Todas vivem em `core/domain` como funções puras, sem acesso a banco ou rede. São a parte do sistema que merece teste unitário de verdade.

### Progressão de carga

Progressão dupla, com a regra explícita:

- Todas as séries de trabalho atingiram o topo da faixa dentro do RIR alvo → sugerir aumento de um incremento, com retorno ao fundo da faixa.
- Alguma série abaixo do fundo da faixa em **duas sessões consecutivas** → sugerir redução de um incremento.
- Qualquer outro caso → manter carga e buscar uma repetição a mais.

Duas proteções importantes. A decisão nunca usa uma única sessão isolada para reduzir carga, porque um treino ruim não é tendência. E o incremento é propriedade do exercício, não uma constante global: halter sobe de 2 em 2 kg, máquina de 2,5 a 5 kg.

### Recordes pessoais

Quatro tipos, detectados na conclusão da série e gravados com referência à série de origem:

| Tipo | Definição |
| --- | --- |
| Maior carga | Maior peso movido com pelo menos uma repetição válida |
| Melhor série | Maior 1RM estimado em uma única série |
| Volume da série | Maior peso × repetições numa série |
| Volume da sessão | Maior tonelagem acumulada no exercício em uma sessão |

O 1RM estimado usa Epley, com validade declarada apenas até cerca de 12 repetições. Acima disso a fórmula perde precisão, e o app deve marcar o valor como estimativa fraca em vez de fingir exatidão.

### Volume

Séries de trabalho por grupo muscular por semana é a métrica principal, porque é a que a literatura usa. Séries de aquecimento e aproximação não contam.

Um exercício distribui volume conforme `exercise_muscles`: grupo primário conta 1,0 série; secundário conta 0,5. É uma convenção, não uma verdade fisiológica, e precisa estar documentada na interface para não induzir o usuário a conclusões erradas.

Tonelagem — soma de peso × repetições — é reportada em paralelo, mas com ressalva: ela premia exercício de carga alta e não é comparável entre grupos musculares diferentes.

### Metas

Quatro tipos: carga em um exercício, peso corporal, frequência semanal e volume semanal em um grupo. Cada meta guarda valor inicial, alvo, prazo e progresso recalculado a cada evento relevante. Meta vencida sem conclusão vira status `expirada`, nunca desaparece silenciosamente.

### Consistência

Aderência é sessões concluídas dividido por sessões planejadas na janela. Sequência conta semanas consecutivas atingindo a meta de frequência, não dias seguidos — dias seguidos penalizariam o descanso, que é parte do programa.

### Detecção de estagnação

Se um exercício passa três sessões consecutivas sem aumento de carga nem de repetições, o sistema sinaliza. Ele **sugere**, nunca altera o programa sozinho: pode ser fadiga acumulada, déficit calórico ou sono ruim, e nenhuma dessas causas se resolve trocando exercício.

## Fluxo de navegação

Dois grupos de rota. `(auth)` é público e sem casca; `(app)` exige sessão e carrega a navegação. O middleware faz a separação, então nenhuma página precisa verificar sessão por conta própria.

| Rota | Grupo | O que exige |
| --- | --- | --- |
| `/entrar`, `/cadastrar`, `/recuperar-senha` | auth | Nada. Com sessão válida, redireciona para `/inicio` |
| `/boas-vindas` | app | Sessão, perfil incompleto |
| `/inicio` | app | Sessão e perfil completo |
| `/treinos`, `/treinos/[id]`, `/treinos/novo` | app | Sessão |
| `/executar/[sessaoId]` | app, tela cheia | Sessão ativa pertencente ao usuário |
| `/exercicios`, `/exercicios/[id]` | app | Sessão |
| `/historico`, `/historico/[sessaoId]` | app | Sessão |
| `/progresso/cargas`, `/progresso/volume`, `/progresso/recordes` | app | Sessão |
| `/metas`, `/corpo`, `/ajustes` | app | Sessão |

A navegação principal expõe cinco destinos: Início, Treinos, Histórico, Progresso e Mais. No celular ela fica na barra inferior; acima de 1024 px vira barra lateral fixa. Metas, Corpo e Ajustes ficam sob Mais no celular e visíveis na lateral no desktop.

O modo execução é a única rota que esconde a navegação inteira, porque disputar toque com a barra inferior durante uma série é erro de usabilidade caro.

Três redirecionamentos automáticos: sem sessão em rota `(app)` vai para `/entrar` guardando o destino; com sessão em rota `(auth)` vai para `/inicio`; perfil incompleto vai para `/boas-vindas` e não sai de lá até concluir.

## Telas

Vinte e uma telas na v1, agrupadas por área.

| Área | Tela | O que faz |
| --- | --- | --- |
| Autenticação | Entrar | E-mail e senha, login Google |
| Autenticação | Cadastrar | Criação de conta com confirmação por e-mail |
| Autenticação | Recuperar senha | Envio e redefinição por link |
| Autenticação | Boas-vindas | Perfil inicial, unidade, objetivo, frequência pretendida |
| Início | Dashboard | Treino de hoje, últimos registros, progresso das metas, consistência da semana |
| Treinos | Lista de treinos | Programas ativos e arquivados |
| Treinos | Detalhe do treino | Dias e exercícios prescritos, botão de iniciar |
| Treinos | Editor de treino | Montar dias, adicionar exercícios, definir séries, faixa, RIR, descanso |
| Execução | Modo execução | Tela cheia, registro de série, cronômetro, veredito de progressão |
| Execução | Resumo da sessão | Tonelagem, duração, recordes batidos, campo de observação |
| Exercícios | Catálogo | Busca e filtro por grupo, equipamento e padrão |
| Exercícios | Detalhe do exercício | Histórico, recordes, curva de carga |
| Exercícios | Novo exercício | Cadastro personalizado |
| Histórico | Lista de sessões | Calendário e lista, com filtro |
| Histórico | Detalhe da sessão | Tudo que foi feito, editável |
| Progresso | Evolução de cargas | Gráfico por exercício ao longo do tempo |
| Progresso | Volume | Séries por grupo muscular por semana |
| Progresso | Recordes | Lista por exercício e tipo |
| Metas | Metas | Criar, acompanhar e concluir |
| Corpo | Peso e medidas | Registro e gráfico de tendência |
| Ajustes | Ajustes | Perfil, preferências, exportar dados, excluir conta |

### A tela que decide o produto

O **modo execução** é onde o app é usado de verdade e onde ele ganha ou perde o usuário. Requisitos próprios dela:

- Ocupa a tela inteira, sem navegação por baixo competindo por toque.
- Registrar uma série leva no máximo dois toques, com valores pré-preenchidos pela sugestão de progressão.
- Cronômetro dispara sozinho ao concluir a série, com o tempo prescrito daquele exercício, e continua rodando com a tela bloqueada.
- Funciona inteiramente offline. Nenhuma ação dessa tela depende de rede.
- Recuperação de sessão: fechar o navegador no meio do treino e voltar retoma exatamente no ponto.
- Wake lock opcional para a tela não apagar durante a série.

## Componentes reutilizáveis

### Primitivos

Base shadcn/ui: botão, campo, seletor, diálogo, folha lateral, aba, cartão, etiqueta, alternador, deslizante, aviso, esqueleto de carregamento, estado vazio.

Um desvio importante do padrão: **todo campo numérico do app usa um componente próprio**, `NumberStepper`, com botões de incremento grandes e teclado numérico nativo. Campo de número padrão em celular, com mão suada, é a principal fonte de erro de digitação num app de treino.

### Componentes de domínio

| Componente | Onde aparece |
| --- | --- |
| `SetRow` | Linha de série com peso, repetições, RIR e conclusão |
| `ExerciseCard` | Exercício dentro da sessão, com estado e contagem |
| `RestTimer` | Cronômetro persistente, sobrevive a navegação |
| `ProgressionBadge` | Veredito visual: subir, manter, reduzir |
| `ExercisePicker` | Busca com filtro, usado no editor e na execução |
| `MuscleVolumeChart` | Séries por grupo por semana |
| `LoadProgressChart` | Evolução de carga de um exercício |
| `ConsistencyGrid` | Malha de frequência por semana |
| `PRBadge` | Marcação de recorde |
| `GoalCard` | Meta com barra de progresso |
| `BodyMetricChart` | Peso e medidas com linha de tendência |
| `EmptyState` | Estado vazio com ação sugerida |

### Hooks compartilhados

`useRestTimer` para o cronômetro global, `useOfflineQueue` para a fila de sincronização, `useActiveSession` para a sessão em andamento, `useWakeLock` para manter a tela ligada, `useMediaQuery` para alternar layout.

## Responsividade e PWA

### Layout

Celular primeiro, com três pontos de quebra e mudança real de estrutura, não apenas redimensionamento.

| Faixa | Layout |
| --- | --- |
| Até 640 px | Coluna única, navegação inferior de cinco itens, ações principais ao alcance do polegar |
| 641 a 1024 px | Duas colunas em listas, navegação lateral recolhível |
| Acima de 1024 px | Barra lateral fixa, área de conteúdo com largura máxima, tabelas densas onde ajudam |

A área segura do iOS é respeitada com `env(safe-area-inset-*)`, e a navegação inferior nunca fica atrás da barra do sistema. Alvo de toque mínimo de 44 px.

O modo execução foge dessa grade: ele é tela cheia em qualquer largura, porque é usado com o celular na mão mesmo quando o usuário abriu no desktop.

### PWA

| Recurso | Implementação |
| --- | --- |
| Manifesto | Nome, ícones 192 e 512, `display: standalone`, tema escuro, atalhos para execução e histórico |
| Service worker | Serwist. Casca do app em cache, fontes e ícones em cache longo |
| Estratégia de cache | Casca com `StaleWhileRevalidate`; dados do usuário nunca em cache de HTTP, sempre via IndexedDB |
| Offline | Dexie guarda sessão ativa, fila de operações e catálogo de exercícios |
| Sincronização | Background Sync onde houver suporte; descarga na reconexão como alternativa |
| Instalação | Convite discreto após a segunda sessão concluída, nunca na primeira visita |
| Atualização | Aviso de nova versão com botão de recarregar, nunca recarga automática durante um treino |

### Desempenho pretendido

Largest Contentful Paint abaixo de 2 segundos em 4G, interação abaixo de 200 ms, e o modo execução respondendo em menos de 100 ms por toque, já que roda contra dados locais. O bundle inicial deve ficar abaixo de 200 KB comprimido, com gráficos carregados sob demanda.

## Etapas de desenvolvimento

Onze etapas. Cada uma termina com algo funcionando de verdade, e nenhuma começa antes de a anterior passar na verificação.

| # | Etapa | Entrega | Como verificar |
| --- | --- | --- | --- |
| 0 | Fundação | Repositório, Next.js, TypeScript, Tailwind, lint, Supabase conectado, deploy vazio no ar | A URL abre em produção |
| 1 | Banco e autenticação | Schema completo, migrations, RLS, cadastro, login, recuperação, middleware | Dois usuários criados; nenhum enxerga o dado do outro |
| 2 | Catálogo de exercícios | Seed de 150 a 200 exercícios, busca, filtro, exercício personalizado | Busca por grupo e equipamento retorna o esperado |
| 3 | Treinos | Criar, editar, duplicar e arquivar programa, dias e prescrições | Programa de 5 dias montado do zero |
| 4 | Execução online | Iniciar sessão, registrar série, cronômetro, concluir | Um treino inteiro registrado sem erro |
| 5 | Regras de domínio | Progressão, recordes, 1RM, volume, consistência, com testes | Suíte de testes verde, casos de borda cobertos |
| 6 | Histórico | Lista, calendário, detalhe, edição retroativa | Sessão antiga editada recalcula os derivados |
| 7 | Progresso | Gráficos de carga, volume e recordes | Números do gráfico batem com consulta manual no banco |
| 8 | Metas e corpo | Metas, peso, medidas, tendência | Meta progride ao registrar treino |
| 9 | Offline e PWA | Dexie, fila, sincronização, service worker, manifesto | Treino completo em modo avião sincroniza ao reconectar |
| 10 | Acabamento | Acessibilidade, desempenho, estados vazios e de erro, exportação, exclusão de conta | Lighthouse acima de 90 nas quatro categorias |

A etapa 9 é deliberadamente tardia. Offline construído cedo, sobre um modelo de dados ainda instável, obriga a refazer a sincronização a cada mudança de schema.

A etapa 5 poderia vir antes da 4, e há bom argumento para isso. Coloquei depois para que as regras sejam escritas contra dados reais registrados na etapa 4, em vez de contra dados imaginados.

## Riscos e fora de escopo

### Riscos

**Sincronização offline é onde os bugs difíceis moram.** Duas abas abertas, relógio do celular errado, operação repetida após timeout. Mitigação: identificadores gerados no cliente, operações idempotentes, e a regra de que o servidor é a autoridade final em qualquer divergência.

**Edição retroativa invalida derivados.** Corrigir uma série de três meses atrás pode mudar recordes, progresso de metas e volume semanal. Toda edição precisa disparar recálculo em cascata, e isso precisa ser pensado desde a etapa 1, não remendado depois.

**O catálogo de exercícios é dado, não código.** Classificação inconsistente de grupo muscular contamina todo o cálculo de volume. Vale revisar o seed com cuidado antes de semear.

**Escopo.** São 21 telas e 11 etapas. O risco maior não é técnico, é abandonar o projeto na etapa 6. Por isso cada etapa entrega algo usável.

### Fora do escopo da v1

Papel de treinador com múltiplos alunos, rede social e compartilhamento, nutrição e macros, integração com relógios e Health Connect, vídeos de execução, importação de outros aplicativos, e aplicativo nativo. Nada disso está descartado; está adiado, e o modelo de dados não fecha porta para nenhum.

### O que preciso de você

Contas próprias em Vercel, Supabase e GitHub, e o Node.js instalado na máquina. Eu escrevo todo o código e as instruções; a execução dos comandos e a conexão das contas são suas, porque não tenho acesso ao seu ambiente.
