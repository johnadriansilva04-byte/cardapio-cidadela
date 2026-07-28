-- Políticas RLS para tabela de battles
-- Execute este SQL no SQL Editor do Supabase

-- Habilitar RLS na tabela battles
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção pública em battles
CREATE POLICY "Permitir inserção pública em battles"
  ON battles
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir leitura pública em battles
CREATE POLICY "Permitir leitura pública em battles"
  ON battles
  FOR SELECT
  USING (true);

-- Política para permitir atualização pública em battles
CREATE POLICY "Permitir atualização pública em battles"
  ON battles
  FOR UPDATE
  WITH CHECK (true);

-- Política para permitir deleção pública em battles
CREATE POLICY "Permitir deleção pública em battles"
  ON battles
  FOR DELETE
  USING (true);
