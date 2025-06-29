const express = require('express');
const router = express.Router();
const path = require('path');
const precoController = require('../controllers/precoController');
const { apenasAdmin } = require('../helpers/auth');

// Página HTML para cadastro de SKU
router.get('/cadastrar-sku', apenasAdmin, (req, res) => {
  res.render('sku');
});
// POST com upload da foto e cadastro de SKU
router.post('/cadastrar-sku', apenasAdmin, precoController.cadastrarSku);

// API JSON para listar preços
router.get('/api/precos', precoController.listarPrecos);

// Página de preços
router.get('/precos', apenasAdmin, precoController.precosPage);

// Adicionar ou atualizar preço
router.post('/precos', apenasAdmin, precoController.adicionarPreco);

// Atualizar preço diretamente por SKU
router.put('/precos/:sku', apenasAdmin, precoController.atualizarPreco);

// Deletar preço por SKU
router.delete('/precos/:sku', apenasAdmin, precoController.deletarPreco);

// ✅ NOVA ROTA para renomear um SKU
router.post('/precos/renomear', apenasAdmin, precoController.renomearSKU);

module.exports = router;
