const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { Pool } = require('pg');
require('dotenv').config({ path: './passwd.env' });

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: `${process.env.PGPASSWORD}`,
  port: process.env.PGPORT,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar no Supabase:', err.message);
  } else {
    console.log('✅ Conectado ao Supabase! Hora atual:', res.rows[0].now);
  }
});

module.exports = pool;
