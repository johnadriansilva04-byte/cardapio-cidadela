-- Políticas RLS para tabelas de administração
-- Execute este SQL no SQL Editor do Supabase

-- Habilitar RLS nas tabelas
ALTER TABLE admin_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE liberation_codes ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção pública em admin_trials
CREATE POLICY "Permitir inserção pública em admin_trials"
  ON admin_trials
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir leitura pública em admin_trials
CREATE POLICY "Permitir leitura pública em admin_trials"
  ON admin_trials
  FOR SELECT
  USING (true);

-- Política para permitir atualização pública em admin_trials
CREATE POLICY "Permitir atualização pública em admin_trials"
  ON admin_trials
  FOR UPDATE
  WITH CHECK (true);

-- Política para permitir inserção pública em liberation_codes
CREATE POLICY "Permitir inserção pública em liberation_codes"
  ON liberation_codes
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir leitura pública em liberation_codes
CREATE POLICY "Permitir leitura pública em liberation_codes"
  ON liberation_codes
  FOR SELECT
  USING (true);

-- Política para permitir atualização pública em liberation_codes
CREATE POLICY "Permitir atualização pública em liberation_codes"
  ON liberation_codes
  FOR UPDATE
  WITH CHECK (true);
