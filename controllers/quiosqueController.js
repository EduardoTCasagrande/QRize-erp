const pool = require('../models/postgres'); // importa o pool de conexão

exports.page = (req, res) => {
  res.render('quiosques');
};

exports.listar = async (req, res) => {
  try {
    const result = await pool.query('SELECT nome FROM quiosques');
    const nomes = result.rows.map(row => row.nome);
    res.json({ quiosques: nomes });
  } catch (err) {
    console.error('Erro ao buscar quiosques:', err.message);
    res.status(500).json({ error: 'Erro ao buscar quiosques' });
  }
};

exports.adicionar = async (req, res) => {
  const { nome, range, colunas } = req.body;

  const sql = 'INSERT INTO quiosques (nome, range, colunas) VALUES ($1, $2, $3)';
  
  try {
    await pool.query(sql, [nome, range, colunas]);
    res.redirect('/');
  } catch (err) {
    console.error('Erro ao inserir quiosque:', err.message);
    res.status(500).send('Erro ao cadastrar quiosque.');
  }
};
