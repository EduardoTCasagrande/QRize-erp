const db = require('../models/db');
const path = require('path');

exports.page = (req, res) => {
  res.render('quiosques')
};

exports.listar = (req, res) => {
  db.all("SELECT nome FROM quiosques", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar quiosques' });
    }
    // Envia só nomes para facilitar
    const nomes = rows.map(row => row.nome);
    res.json({ quiosques: nomes });
  });
};


exports.adicionar = (req, res) => {
  const { nome, range, colunas } = req.body;
  const sql = 'INSERT INTO quiosques (nome, range, colunas) VALUES (?, ?, ?)';

  db.run(sql, [nome, range, colunas], (err) => {
    if (err) {
      console.error('Erro ao inserir quiosque:', err.message);
      return res.status(500).send('Erro ao cadastrar quiosque.');
    }
    res.redirect('/');
  });
};
