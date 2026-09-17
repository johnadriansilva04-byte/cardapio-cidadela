-- ============================================================
-- PUSH SUBSCRIPTIONS — armazena tokens FCM dos dispositivos
-- Cada linha representa um dispositivo inscrito para receber
-- notificações push quando novos pedidos chegarem.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Um token FCM é único por restaurante (cada dispositivo tem seu próprio token)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_token_restaurant
  ON push_subscriptions(token, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_restaurant
  ON push_subscriptions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id);

-- Permissões
GRANT SELECT ON TABLE push_subscriptions TO anon, authenticated;
GRANT ALL ON TABLE push_subscriptions TO authenticated;
