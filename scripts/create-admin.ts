/**
 * Cria (ou redefine a senha de) um administrador direto no banco de dados.
 *
 *   npm run admin:create
 *
 * O e-mail e a senha são digitados no terminal (a senha não aparece na tela) e
 * gravados apenas na tabela `admin_users`, com a senha em hash PBKDF2.
 * Nenhuma credencial de administrador fica em arquivo ou variável de ambiente.
 * Usa DIRECT_URL (ou DATABASE_URL) do .env apenas para conectar ao banco.
 */
import { createInterface } from "node:readline";
import pg from "pg";
import { hashPassword } from "../src/server/crypto.ts";

const connectionString = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("Defina DIRECT_URL ou DATABASE_URL no .env.");
  process.exit(1);
}

// Uma única interface de leitura para todas as perguntas (funciona em terminal e via pipe).
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});
let muted = false;
const writer = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
const originalWrite = writer._writeToOutput.bind(rl);
writer._writeToOutput = (s: string) => {
  // Com `muted`, a senha digitada não aparece na tela.
  if (!muted) originalWrite(s);
  else if (/\r|\n/.test(s)) writer.output.write("\n");
};

// O iterador guarda as linhas recebidas, então funciona tanto digitando quanto via pipe.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false): Promise<string> {
  muted = false;
  writer.output.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  return typeof value === "string" ? value : "";
}

const email = (await ask("E-mail do administrador: ")).trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("E-mail inválido.");
  process.exit(1);
}
const password = await ask("Senha (mín. 6 caracteres): ", true);
if (password.length < 6) {
  console.error("A senha deve ter pelo menos 6 caracteres.");
  process.exit(1);
}
if ((await ask("Confirme a senha: ", true)) !== password) {
  console.error("As senhas não conferem.");
  process.exit(1);
}
rl.close();

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const passwordHash = await hashPassword(password);
  await client.query(
    `INSERT INTO admin_users (id, email, password_hash) VALUES (gen_random_uuid(), $1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, passwordHash],
  );
  // Ao redefinir a senha, encerra as sessões abertas desse administrador.
  await client.query(
    `UPDATE sessions SET revoked_at = now()
     WHERE revoked_at IS NULL AND admin_id = (SELECT id FROM admin_users WHERE email = $1)`,
    [email],
  );
  console.log(`Administrador ${email} salvo no banco de dados.`);
} finally {
  await client.end();
}
