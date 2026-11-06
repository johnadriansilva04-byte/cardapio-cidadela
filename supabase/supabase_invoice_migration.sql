-- Pedido de nota fiscal (NFS-e) — fila de solicitações do dono.
--
-- O app NÃO emite nota: a emissão depende de inscrição municipal e do
-- enquadramento fiscal (o MEI atual não comporta venda de software). O que esta
-- migração cria é o canal pelo qual o dono PEDE a nota e o fornecedor sabe que
-- precisa emitir e entregar.
--
-- Desenho de segurança:
--   * O dono só INSERE e LÊ os próprios pedidos (via `is_restaurant_owner`).
--     Não há policy de UPDATE: quem marca `emitted`/`rejected` e anexa o
--     arquivo é a service role (painel do fornecedor / SQL).
--   * Um trigger guard (SECURITY INVOKER, como o do Premium) força os campos
--     de controle para os valores iniciais quando quem escreve não é
--     privilegiado — sem ele o dono daria `PATCH status='emitted'` e o pedido
--     sairia da fila sem nota nenhuma.
--   * `anon` não recebe grant: dado fiscal é do dono, não é público.
--
-- Idempotente: pode rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Quem pediu (auth.uid() no momento da inserção), para auditoria.
  requested_by UUID,
  -- O que está sendo faturado. `reference_id` é o id do pagamento (diária) ou
  -- o preapproval (assinatura); pode ser nulo no Premium.
  kind TEXT NOT NULL CHECK (kind IN ('annual', 'monthly', 'day_pass')),
  reference_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 60),
  -- Valor em centavos. Só a service role escreve (o dono não informa preço).
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  -- Tomador do serviço: pessoa física (CPF) ou jurídica (CNPJ).
  person_type TEXT NOT NULL CHECK (person_type IN ('cpf', 'cnpj')),
  tax_id TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  -- Ciclo de vida. `pending` = na fila do fornecedor.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'emitted', 'rejected')),
  -- Campos preenchidos pelo fornecedor ao emitir.
  emitted_at TIMESTAMPTZ,
  storage_path TEXT,
  file_name TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_requests_restaurant
  ON invoice_requests (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status
  ON invoice_requests (status, created_at);

-- Um pedido pendente por (loja, tipo, pagamento): evita a mesma compra ser
-- pedida duas vezes enquanto a primeira ainda não foi atendida.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_requests_unique_pending
  ON invoice_requests (restaurant_id, kind, reference_id)
  WHERE status = 'pending' AND reference_id IS NOT NULL;

ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

-- O dono lê os pedidos das lojas que são dele.
DROP POLICY IF EXISTS "owner_read_invoice_requests" ON invoice_requests;
CREATE POLICY "owner_read_invoice_requests" ON invoice_requests FOR SELECT
  TO authenticated
  USING (is_restaurant_owner(restaurant_id));

-- O dono cria o pedido, mas só para a própria loja.
DROP POLICY IF EXISTS "owner_insert_invoice_requests" ON invoice_requests;
CREATE POLICY "owner_insert_invoice_requests" ON invoice_requests FOR INSERT
  TO authenticated
  WITH CHECK (is_restaurant_owner(restaurant_id));

-- Sem policy de UPDATE/DELETE para o dono: só a service role muda o estado.

GRANT SELECT, INSERT ON TABLE invoice_requests TO authenticated;
GRANT ALL ON TABLE invoice_requests TO service_role;
-- Dado fiscal do dono não é público.
REVOKE ALL ON TABLE invoice_requests FROM anon;

-- Guard: o cliente só cria pedidos PENDENTES. Qualquer tentativa de gravar
-- status de emissão, arquivo ou valor cai fora — sem isso bastava um PATCH
-- para o pedido sair da fila como "emitido" e nunca ser faturado.
CREATE OR REPLACE FUNCTION public.guard_invoice_requests()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_privileged BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  IF NOT is_privileged THEN
    IF COALESCE(NEW.status, 'pending') <> 'pending' THEN
      RAISE EXCEPTION 'status da nota é definido só pelo fornecedor';
    END IF;
    IF NEW.emitted_at IS NOT NULL
       OR NEW.storage_path IS NOT NULL
       OR NEW.file_name IS NOT NULL
       OR NEW.admin_notes IS NOT NULL THEN
      RAISE EXCEPTION 'campos de emissão são somente leitura para o cliente';
    END IF;
    -- O preço é do servidor: o dono não informa quanto pagou.
    NEW.amount_cents := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Carimba quem pediu. Na inserção direta pelo dono, `auth.uid()` é o dono.
    -- Na rota (service role), `auth.uid()` é NULL e o `requested_by` que a rota
    -- já resolveu precisa sobreviver — sem o COALESCE a auditoria virava NULL.
    NEW.requested_by := COALESCE(auth.uid(), NEW.requested_by);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_requests ON invoice_requests;
CREATE TRIGGER trg_guard_invoice_requests
  BEFORE INSERT OR UPDATE ON invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_requests();
