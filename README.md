# Almore — Fases 1 e 2

Plataforma de gerenciamento de treino. Esta fase entrega a fundação:
projeto, banco, autenticação, perfil, layout, navegação e dashboard.

## O que roda hoje

### Fase 2 — catálogo de exercícios
- 106 exercícios curados, 19 grupos musculares, 213 vínculos musculares
- Busca por nome e filtros por músculo, equipamento, padrão e origem
- Cadastro de exercício personalizado, com grupo primário e secundários
- Arquivamento lógico do exercício próprio, preservando histórico futuro
- RLS: catálogo global legível por todos, personalizado só pelo dono

### Fase 1 — fundação

- Cadastro, login, logout e recuperação de senha
- Confirmação de e-mail com rota de callback
- Perfil criado automaticamente no cadastro, via trigger no banco
- Onboarding obrigatório antes de acessar o app
- Proteção de rotas por middleware, com retorno ao destino pretendido
- Row Level Security ativo: nenhum usuário lê o dado de outro
- Navegação inferior no celular e barra lateral no desktop
- Dashboard lendo o perfil real do banco

## Subindo o projeto

### 1. Supabase

1. Crie um projeto em supabase.com.
2. Abra **SQL Editor** e rode, nesta ordem:
   - `supabase/migrations/0001_profiles.sql`
   - `supabase/migrations/0002_exercises.sql`
   - `supabase/seed/0003_exercises_seed.sql`
   - `supabase/migrations/0004_touch_updated_at_search_path.sql`
3. Em **Authentication > URL Configuration**, defina Site URL como
   `http://localhost:3000` e adicione `http://localhost:3000/auth/callback`
   em Redirect URLs. Repita com a URL de produção quando publicar.
4. Em **Authentication > Providers > Email**, mantenha "Confirm email" ligado.

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com os valores de **Settings > API** do seu projeto Supabase.

### 3. Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint` | ESLint |
| `python3 scripts/gerar_seed.py` | Regera o seed de exercícios |

## Como adicionar exercícios ao catálogo

Edite a tabela `RAW` em `scripts/gerar_seed.py`, uma linha por exercício, e rode
o script. Ele valida os grupos musculares e regenera o SQL. O seed é idempotente:
rodar de novo atualiza os existentes sem duplicar.

## Decisões de arquitetura desta fase

**Drizzle serve apenas para tipos TypeScript derivados do schema.** A fonte
de verdade do banco são as migrations SQL escritas à mão em
`supabase/migrations`, aplicadas manualmente no SQL Editor do Supabase.
`src/core/db/schema.ts` precisa espelhar o SQL, mas nunca o gera nem o
aplica. Por isso o projeto não tem `drizzle.config.ts` nem os scripts
`db:generate` e `db:push`.

**O runtime lê via supabase-js.** As consultas em tempo de execução passam
pelo cliente Supabase porque ele carrega o JWT do usuário, o que faz o Row
Level Security valer de fato. Uma conexão direta por Drizzle usaria o papel
de serviço e passaria por cima do RLS.

**Falha fechada.** Se o Supabase estiver fora do ar, o middleware não
consegue validar a sessão e manda para o login. É a escolha segura: melhor
pedir login de novo do que servir conteúdo sem verificar quem é.

**`getUser`, nunca `getSession`.** `getSession` confia no cookie sem validar
o token no servidor.

## Para quem for continuar o projeto

Leia `AGENTS.md` antes de alterar qualquer coisa. Ele traz o estado atual,
as regras de arquitetura que não podem ser quebradas e o que vem na próxima
fase. O planejamento técnico completo vai em `docs/PLANEJAMENTO.md`.
