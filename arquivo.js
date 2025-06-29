const db = require('./models/db'); // seu caminho para o db

const username = 'Repositor';
const senha = 'galpao1';
const quiosque = '';
const admin = 0;
const nivel = 'repositor';

const bcrypt = require('bcrypt');

async function criarUsuario() {
  const hash = await bcrypt.hash(senha, 10);
  db.run(`INSERT INTO usuarios (username, senha, quiosque, admin, nivel) VALUES (?, ?, ?, ?, ?)`,
    [username, hash, quiosque, admin, nivel], function(err) {
      if (err) return console.error(err.message);
      console.log('Usuário repositor criado com sucesso');
      process.exit();
    });
}

criarUsuario();
