const path = require('path');
const db = require('../models/db');
const normalizeQuiosque = require('../helpers/normalizeQuiosque');

let reposicaoPlanejadaPorQuiosque = {};
let contagemAtualPorQuiosque = {};


exports.renderReposicaoPage = (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/');

  res.render('reposicao', { user });
};


exports.renderReposicaoPageMobile = (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('reposicao-mobile', { user: req.session.user }); // <- manda o user inteiro
};



exports.salvarReposicao = (req, res) => {
  const { dados, quiosque } = req.body;

  const quiosqueFinal = quiosque || req.session?.user?.quiosque;

  if (!quiosqueFinal || !dados) {
    return res.status(400).json({ status: 'erro', mensagem: 'Quiosque ou dados ausentes' });
  }

  const key = normalizeQuiosque(quiosqueFinal);
  reposicaoPlanejadaPorQuiosque[key] = dados;
  contagemAtualPorQuiosque[key] = {};

  res.json({
    status: 'ok',
    mensagem: `Reposição atualizada com sucesso para o quiosque ${quiosqueFinal}.`,
    atual: contagemAtualPorQuiosque[key],
    planejado: reposicaoPlanejadaPorQuiosque[key]
  });
};


exports.biparSku = (req, res) => {
  const { sku, quiosque, mobile } = req.body;

  const quiosqueFinal = quiosque || req.session?.user?.quiosque;
  const key = normalizeQuiosque(quiosqueFinal);

  if (!quiosqueFinal || !sku) {
    return res.status(400).json({ status: 'erro', mensagem: 'Quiosque ou SKU não enviados' });
  }

  // Se for mobile, SKU precisa estar na lista planejada
  if (mobile) {
    if (!reposicaoPlanejadaPorQuiosque[key] || !reposicaoPlanejadaPorQuiosque[key][sku]) {
      return res.status(400).json({
        status: 'erro',
        mensagem: `SKU '${sku}' não está na lista de reposição para o quiosque '${quiosqueFinal}'.`
      });
    }
  }

  // Se não for mobile, aceita qualquer SKU (sem validação contra lista planejada)

  // Fator de multiplicação padrão (1)
  let quantidadeIncremento = 1;

  // Se for prendedor (kit de 5 unidades)
  if (sku.includes('prendedor menina') || sku.includes('prendedor menino')) {
    quantidadeIncremento = 5;
  }

  // Se for KIT (kit de 20 unidades)
  if (sku.includes('kit')) {
    quantidadeIncremento = 20;
  }

  // Atualiza a contagem de bipagens (em número de bipagens, não unidades reais)
  contagemAtualPorQuiosque[key][sku] = (contagemAtualPorQuiosque[key][sku] || 0) + 1;

  // Atualiza o estoque real (em unidades reais)
  db.run(`
    INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
    VALUES (?, ?, ?)
    ON CONFLICT(quiosque, sku)
    DO UPDATE SET quantidade = quantidade + ?
  `, [quiosqueFinal, sku, quantidadeIncremento, quantidadeIncremento], (err) => {
    if (err) {
      console.error("Erro ao atualizar estoque:", err.message);
    }
  });

  res.json({
    status: 'ok',
    mensagem: `SKU '${sku}' registrado para o quiosque '${quiosqueFinal}' (+${quantidadeIncremento} unidades no estoque).`,
    atual: { ...contagemAtualPorQuiosque[key] }
  });
};
