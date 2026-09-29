# Almore — Fase 1

Plataforma de gerenciamento de treino. Esta fase entrega a fundação:
projeto, banco, autenticação, perfil, layout, navegação e dashboard.

## O que roda nesta fase

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
2. Abra **SQL Editor** e rode o conteúdo de `supabase/migrations/0001_profiles.sql`.
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
| `npm run db:generate` | Gera migration a partir do schema Drizzle |

## Decisões de arquitetura desta fase

**Drizzle define o schema; o runtime lê via supabase-js.** Drizzle é a fonte
de verdade das tabelas e das migrations. As consultas em tempo de execução
passam pelo cliente Supabase porque ele carrega o JWT do usuário, o que faz o
Row Level Security valer de fato. Uma conexão direta por Drizzle usaria o
papel de serviço e passaria por cima do RLS.

**Falha fechada.** Se o Supabase estiver fora do ar, o middleware não
consegue validar a sessão e manda para o login. É a escolha segura: melhor
pedir login de novo do que servir conteúdo sem verificar quem é.

**`getUser`, nunca `getSession`.** `getSession` confia no cookie sem validar
o token no servidor.
