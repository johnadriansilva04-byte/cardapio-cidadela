-- Protocolos de atendimento do suporte (Pracinha).
--
-- Antes desta migração o relato NÃO era guardado em lugar nenhum: a rota de
-- suporte montava o e-mail e o mandava pelo Resend. Se o e-mail falhasse, se
-- alguém apagasse a caixa ou se o dono quisesse reencontrar o caso, não havia
-- como. Não existia protocolo, nem histórico, nem busca.
--
-- Esta tabela é o registro durável de cada relato (erro ou conversa de
-- suporte), com um protocolo curto que o dono pode citar depois.
--
-- Desenho de segurança:
--   * Quem escreve é a rota (service role): o erro pode acontecer antes do
--     login, então o INSERT não pode depender de auth.uid().
--   * O dono LÊ os relatos das lojas que são dele (`is_restaurant_owner`) e os
--     que ele mesmo abriu (`reporter_id = auth.uid()`).
--   * `anon` não recebe grant: o relato pode conter dado do cliente, não é
--     público. A busca por protocolo passa pela rota, que devolve só o resumo.
--   * Nada de UPDATE/DELETE para o cliente: o ciclo de vida (status) é do time.
--
-- Idempotente: pode rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS support_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Protocolo de atendimento, ex.: CID-20261104-A3F9K2. Único por relato.
  protocol TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('suporte', 'erro')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'fixed', 'closed')),
  -- Quem reportou. Nulo quando o erro acontece antes do login.
  reporter_id UUID,
  reporter_email TEXT,
  -- Contexto da loja. `restaurant_id` pode ser nulo (relato sem loja).
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT,
  route TEXT,
  -- Resumo legível: a mensagem do erro ou a última fala do cliente.
  message TEXT,
  -- Payload completo (turnos da conversa, stack, meta do dispositivo).
  detail JSONB,
  -- Se o aviso por e-mail saiu. O relato vale mesmo sem o e-mail.
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_reports_protocol ON support_reports (protocol);
CREATE INDEX IF NOT EXISTS idx_support_reports_restaurant
  ON support_reports (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_reports_status ON support_reports (status, created_at DESC);

ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;

-- O dono lê os relatos da própria loja.
DROP POLICY IF EXISTS "owner_read_support_reports" ON support_reports;
CREATE POLICY "owner_read_support_reports" ON support_reports FOR SELECT
  TO authenticated
  USING (is_restaurant_owner(restaurant_id));

-- O dono também lê o que ele mesmo abriu, mesmo sem loja associada.
DROP POLICY IF EXISTS "reporter_read_support_reports" ON support_reports;
CREATE POLICY "reporter_read_support_reports" ON support_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE para o cliente: a rota (service role) grava, e o
-- time muda o status. Se o cliente pudesse escrever, ele forjaria protocolos.
GRANT SELECT ON TABLE support_reports TO authenticated;
GRANT ALL ON TABLE support_reports TO service_role;
REVOKE ALL ON TABLE support_reports FROM anon;
