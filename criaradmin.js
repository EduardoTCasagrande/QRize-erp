const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./quiosques.db');

async function criarUsuarioDeus() {
  const hash = await bcrypt.hash('PRINCESAREBORN', 10); // senha segura
  db.run(
    `INSERT INTO usuarios (username, senha, quiosque, admin, nivel) VALUES (?, ?, ?, ?, ?)`, 
    ['BRENDA', hash, 'Matriz', 1, 'admin'], 
    function(err) {
      if (err) {
        console.error("Erro ao criar usuário deus:", err.message);
      } else {
        console.log("Usuário nível 'deus' criado com sucesso!");
      }
      db.close();
    }
  );
}

criarUsuarioDeus();
