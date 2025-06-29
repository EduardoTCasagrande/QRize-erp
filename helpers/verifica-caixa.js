const db = require('../models/db');
const resp = require('../helpers/res');
const path = require('path');

exports.verificarCaixaAberto = (req, res, next) => {
  const quiosque = req.body?.quiosque || req.params?.quiosque || req.session?.user?.quiosque;

  if (!quiosque) {
    return res.status(400).render('erro', {
      titulo: 'Erro de Verificação',
      mensagem: 'Quiosque não informado para verificação do caixa.',
      imagem: './404png.png',
      icone: '⚠️'
    });
  }

  db.get(`
    SELECT aberto FROM caixa_status WHERE quiosque = ?
  `, [quiosque], (err, row) => {
    if (err) {
      console.error('Erro ao verificar status do caixa:', err.message);
      return res.status(500).render('erro', {
        titulo: 'Erro Interno',
        mensagem: 'Erro ao consultar o status do caixa.',
        imagem: '404png.png',
        icone: '💥'
      });
    }

    if (!row || row.aberto !== 1) {
      return resp.caixaFechado(res); 
    }

    next(); 
  });
};
