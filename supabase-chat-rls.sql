-- Políticas RLS para tabela de chat
-- Execute este SQL no SQL Editor do Supabase

-- Habilitar RLS na tabela chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção pública em chat_messages
CREATE POLICY "Permitir inserção pública em chat_messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir leitura pública em chat_messages
CREATE POLICY "Permitir leitura pública em chat_messages"
  ON chat_messages
  FOR SELECT
  USING (true);

-- Política para permitir atualização pública em chat_messages
CREATE POLICY "Permitir atualização pública em chat_messages"
  ON chat_messages
  FOR UPDATE
  WITH CHECK (true);

-- Política para permitir deleção pública em chat_messages
CREATE POLICY "Permitir deleção pública em chat_messages"
  ON chat_messages
  FOR DELETE
  USING (true);
