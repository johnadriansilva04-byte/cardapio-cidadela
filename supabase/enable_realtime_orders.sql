-- ============================================================
-- HABILITA REALTIME DA TABELA ORDERS (ALARME DE NOVO PEDIDO)
-- Rode este trecho no Supabase SQL Editor (idempotente — pode rodar à vontade).
-- Isso faz o painel tocar o barulho automaticamente quando um pedido chegar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
      RAISE NOTICE 'Realtime habilitado para orders — alarme ativo!';
    ELSE
      RAISE NOTICE 'orders ja esta no realtime — alarme ativo!';
    END IF;
  ELSE
    RAISE NOTICE 'ATENCAO: publication supabase_realtime nao existe — habilite Realtime no dashboard do Supabase (Database -> Replication) antes de rodar.';
  END IF;
END $$;