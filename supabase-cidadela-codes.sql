-- Tabela cidadela_codes com políticas RLS configuradas
-- Execute este SQL no painel do Supabase (SQL Editor)

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS cidadela_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL,
  customer_phone TEXT,
  access_type TEXT NOT NULL, -- '15_min' ou '15_dias'
  order_total DECIMAL(10, 2),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_code (code),
  INDEX idx_store_id (store_id),
  INDEX idx_expires_at (expires_at)
);

-- Habilitar RLS
ALTER TABLE cidadela_codes ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserts (qualquer um pode inserir)
CREATE POLICY "Allow insert for all users" 
ON cidadela_codes 
FOR INSERT 
WITH CHECK (true);

-- Política para permitir selects (qualquer um pode ler)
CREATE POLICY "Allow select for all users" 
ON cidadela_codes 
FOR SELECT 
USING (true);

-- Política para permitir updates (qualquer um pode atualizar)
CREATE POLICY "Allow update for all users" 
ON cidadela_codes 
FOR UPDATE 
USING (true);

-- Política para permitir deletes (qualquer um pode deletar)
CREATE POLICY "Allow delete for all users" 
ON cidadela_codes 
FOR DELETE 
USING (true);
