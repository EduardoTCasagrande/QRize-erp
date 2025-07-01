const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'QRizeDB',
  password: 'Casagrande1@2!',
  port: 5432,
});

pool.connect()
  .then(() => console.log('Conectado ao PostgreSQL com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao PostgreSQL:', err.message));

module.exports = pool;