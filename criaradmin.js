const bcrypt = require('bcrypt');
const pool = require('./models/postgres'); // ajuste o caminho conforme sua estrutura

async function criarUsuarioDeus() {
  try {
    const hash = await bcrypt.hash('Casagrande1@2!', 10); // senha segura

    // Primeiro, encontrar o ID do quiosque 'Matriz'
    const { rows } = await pool.query(`SELECT id FROM quiosques WHERE nome = $1`, ['Matriz']);

    if (rows.length === 0) {
      console.error("❌ Quiosque 'Matriz' não encontrado. Crie ele primeiro na tabela quiosques.");
      return;
    }

    const quiosque_id = rows[0].id;

    // Inserir o usuário
    await pool.query(
      `INSERT INTO usuarios (username, senha, quiosque_id, admin, nivel)
       VALUES ($1, $2, $3, $4, $5)`,
      ['DADO', hash, quiosque_id, 1, 'DEUS']
    );

    console.log("✅ Usuário nível 'DEUS' criado com sucesso!");

  } catch (err) {
    console.error('❌ Erro ao criar usuário deus:', err.message);
  } finally {
    await pool.end(); // encerra a conexão após a operação
  }
}

criarUsuarioDeus();
