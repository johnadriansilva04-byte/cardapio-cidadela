# Configuração do Google OAuth no Supabase

Para que o login com Google funcione, você precisa configurar o Google OAuth no painel do Supabase.

## Passo 1: Criar projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. No menu lateral, vá em "APIs & Services" > "Credentials"
4. Clique em "Create Credentials" > "OAuth client ID"

## Passo 2: Configurar OAuth Client ID

1. Se aparecer o aviso de consentimento, configure o "OAuth consent screen":
   - Escolha "External" (para qualquer usuário com Google)
   - Preencha os campos obrigatórios (nome do app, e-mail de suporte)
   - Pode adicionar como "Test users" o seu e-mail para testar
   - Salve e aguarde aprovação (pode levar alguns minutos)

2. Crie o OAuth client ID:
   - Application type: "Web application"
   - Name: "Cardápio Cidadela"
   - Authorized redirect URIs:
     - `https://hkzhksauilonqppipjyc.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/v1/callback` (para desenvolvimento local)
   - Clique em "Create"

3. Copie o **Client ID** e **Client Secret** gerados

## Passo 3: Configurar no Supabase

1. Acesse o [painel do Supabase](https://supabase.com/dashboard)
2. Vá no seu projeto
3. No menu lateral, vá em "Authentication" > "Providers"
4. Ative o provedor "Google"
5. Cole o **Client ID** e **Client Secret** do Google
6. Configure o redirect URL:
   - Site URL: `https://seu-dominio.com` (ou `http://localhost:5173` para local)
   - Redirect URLs: `https://hkzhksauilonqppipjyc.supabase.co/auth/v1/callback`
7. Clique em "Save"

## Passo 4: Atualizar Environment Variables

Se necessário, atualize as variáveis de ambiente no seu projeto:

```env
VITE_SUPABASE_URL=https://hkzhksauilonqppipjyc.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

## Passo 5: Testar

1. Execute o projeto localmente
2. Tente fazer login no painel admin clicando em "Entrar com Google"
3. Será redirecionado para a página de login do Google
4. Após autorizar, será redirecionado de volta para o aplicativo

## Solução de Problemas

### Erro: "redirect_uri_mismatch"
- Verifique se o redirect URL no Google Cloud Console corresponde exatamente ao configurado no Supabase
- Inclua tanto a URL de produção quanto a de desenvolvimento local

### Erro: "unauthorized_client"
- Verifique se o OAuth consent screen foi configurado corretamente
- Se estiver em modo de teste, certifique-se de que seu e-mail está na lista de "Test users"

### Login não redireciona corretamente
- Verifique se a URL do Supabase está correta nas variáveis de ambiente
- Verifique se o redirect URL está configurado corretamente no painel do Supabase
