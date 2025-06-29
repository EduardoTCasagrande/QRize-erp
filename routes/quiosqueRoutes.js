const express = require('express');
const router = express.Router();
const quiosqueController = require('../controllers/quiosqueController');
const db = require('../models/db');
const { apenasAdmin } = require('../helpers/auth');


router.get('/quiosque', apenasAdmin, quiosqueController.page);
router.get('/quiosques', quiosqueController.listar);
router.post('/add', apenasAdmin, quiosqueController.adicionar);

router.get('/quiosque-info/:nome', (req, res) => {
  const nome = req.params.nome;

  db.get('SELECT range, colunas FROM quiosques WHERE nome = ?', [nome], (err, row) => {
    if (err) {
      console.error('Erro ao buscar informações do quiosque:', err.message);
      return res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao buscar quiosque.' });
    }

    if (!row) {
      return res.status(404).json({ status: 'erro', mensagem: 'Quiosque não encontrado.' });
    }

    res.json({
      status: 'ok',
      quiosque: nome,
      range: row.range,
      colunas: row.colunas
    });
  });
});


module.exports = router;
