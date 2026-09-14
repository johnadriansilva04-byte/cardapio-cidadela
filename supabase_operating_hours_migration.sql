-- Horário de funcionamento por restaurante
-- Rode este SQL no SQL Editor do Supabase (Dashboard > SQL Editor > New Query)
-- Ele é idempotente (IF NOT EXISTS) — pode rodar quantas vezes quiser.

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS operating_hours jsonb;

-- Valor padrão: 17:00 — 00:00 todos os dias aberto
-- Apenas para linhas antigas que ainda estão NULL
UPDATE public.restaurants
SET operating_hours = '{
  "seg": {"closed": false, "open": "17:00", "close": "00:00"},
  "ter": {"closed": false, "open": "17:00", "close": "00:00"},
  "qua": {"closed": false, "open": "17:00", "close": "00:00"},
  "qui": {"closed": false, "open": "17:00", "close": "00:00"},
  "sex": {"closed": false, "open": "17:00", "close": "00:00"},
  "sab": {"closed": false, "open": "17:00", "close": "00:00"},
  "dom": {"closed": false, "open": "17:00", "close": "00:00"}
}'::jsonb
WHERE operating_hours IS NULL;

-- Opcional: garantir que o realtime envie mudanças de restaurants para o cardápio público
-- (se já estiver ativo, esta linha não faz nada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
  END IF;
END $$;
