-- Endurecimento dos grants das tabelas de push (defesa em profundidade).
--
-- O grant default do Supabase deixa ALL para anon/authenticated em toda tabela
-- nova. `push_vapid` guarda a CHAVE PRIVADA VAPID (o segredo que assina os
-- pushes) e `push_subscriptions` guarda os endpoints dos dispositivos; nenhuma
-- das duas tinha o REVOKE do anon.
--
-- O RLS já bloqueia: as duas têm RLS ligado e não há policy para anon, então um
-- visitante sem login não lê nem escreve. Mas o resto do schema segue a regra de
-- não depender só do RLS para dado sensível (foi assim com admin_trials) e um
-- `DISABLE ROW LEVEL SECURITY` acidental, ou uma policy nova ampla, exporia o
-- segredo de assinatura do push. Este REVOKE fecha essa segunda camada.
--
-- O cliente nunca acessa as duas tabelas direto como anon: a inscrição do
-- dispositivo é feita logado (authenticated) e a chave pública VAPID chega pela
-- Edge Function `push-vapid-key` (service_role). Nada do fluxo de push depende
-- do grant de anon.
--
-- Idempotente: pode rodar mais de uma vez.

DO $$
BEGIN
  IF to_regclass('public.push_vapid') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.push_vapid FROM anon;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
  END IF;
END $$;

-- Garante que o service_role (Edge Functions) continua com acesso total, mesmo
-- que o REVOKE acima tenha tocado nos defaults.
GRANT ALL ON TABLE push_vapid, push_subscriptions TO service_role;
