const express = require('express');
const router = express.Router();
const relatorioFechamentoController = require('../controllers/fechamentoController');

router.get('/relatorios/fechamento', relatorioFechamentoController.listarFechamentos); // lista JSON
router.get('/fechamentos', relatorioFechamentoController.paginaFechamentos);          // página EJS
router.get('/relatorios/ler/:nomeArquivo', relatorioFechamentoController.ler);       // ler/baixar arquivo
router.delete('/relatorios/fechamento/:nomeArquivo', relatorioFechamentoController.deletar); // deletar arquivo

module.exports = router;
