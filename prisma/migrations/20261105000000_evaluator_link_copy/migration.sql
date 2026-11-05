-- Permite copiar novamente o link do avaliador: o token é guardado criptografado
-- (AES-256-GCM, chave derivada de SESSION_SECRET). Coluna nula para convites antigos.
ALTER TABLE "evaluators" ADD COLUMN "token_ciphertext" TEXT;
