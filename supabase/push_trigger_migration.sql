-- ============================================================
-- PUSH TRIGGER — dispara a Edge Function send-push-notification
-- a cada INSERT em orders (novo pedido).
--
-- Rode este arquivo no Supabase → SQL Editor → Run (uma vez).
--
-- O que faz:
--   1. Garante a extensão pg_net (HTTP async do banco).
--   2. Cria a função notify_new_order_push() que faz o POST da
--      linha do pedido para a Edge Function.
--   3. Cria o trigger no INSERT da tabela orders.
--
-- Importante: este projeto NÃO define app.settings.* — a URL do
-- Supabase e a anon key entram por variáveis do projeto, editáveis
-- no Dashboard (Database → Settings → General → App settings).
-- ============================================================

create extension if not exists pg_net;

create or replace function public.notify_new_order_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- URL do próprio projeto e anon key, configuradas em
  -- Dashboard → Database → App settings (chaves app.settings.*).
  -- app.settings.base_url: ex. https://SEU-PROJETO.supabase.co
  v_url := current_setting('app.settings.base_url', true);
  v_key := current_setting('app.settings.anon_key', true);

  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    -- Sem config: não quebra o INSERT do pedido, apenas pula o push.
    raise notice 'push trigger: app.settings not configured, skipping push';
    return new;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := to_jsonb(new)
  );

  return new;
end;
$$;

-- 3. Trigger no INSERT de orders
drop trigger if exists trg_notify_new_order_push on public.orders;
create trigger trg_notify_new_order_push
  after insert on public.orders
  for each row
  execute function public.notify_new_order_push();
