const path = require('path');
const pool = require('../models/postgres'); // pool Postgres
const normalizeQuiosque = require('../helpers/normalizeQuiosque');

let reposicaoPlanejadaPorQuiosque = {};
let contagemAtualPorQuiosque = {};

// Função auxiliar para obter o ID do quiosque pelo nome
async function getQuiosqueIdPorNome(nomeQuiosque) {
  const res = await pool.query('SELECT id FROM quiosques WHERE nome = $1', [nomeQuiosque]);
  if (res.rows.length === 0) throw new Error(`Quiosque '${nomeQuiosque}' não encontrado.`);
  return res.rows[0].id;
}

exports.renderReposicaoPage = (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/');
  res.render('reposicao', { user });
};

exports.renderReposicaoPageMobile = (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('reposicao-mobile', { user: req.session.user });
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

exports.biparSku = async (req, res) => {
  let { sku, quiosque, mobile } = req.body;
  if (!quiosque || !sku) {
    return res.status(400).json({ status: 'erro', mensagem: 'Quiosque ou SKU não enviados' });
  }

  try {
    // Se quiosque não for número, converte para id
    let quiosqueId = Number(quiosque);
    if (isNaN(quiosqueId)) {
      quiosqueId = await getQuiosqueIdPorNome(quiosque);
    }

    const key = normalizeQuiosque(quiosque);

    if (mobile) {
      if (!reposicaoPlanejadaPorQuiosque[key] || !reposicaoPlanejadaPorQuiosque[key][sku]) {
        return res.status(400).json({
          status: 'erro',
          mensagem: `SKU '${sku}' não está na lista de reposição para o quiosque '${quiosque}'.`
        });
      }
    }

    let quantidadeIncremento = 1;
    if (sku.toLowerCase().includes('prendedor menina') || sku.toLowerCase().includes('prendedor menino')) {
      quantidadeIncremento = 5;
    }
    if (sku.toLowerCase().includes('kit')) {
      quantidadeIncremento = 20;
    }

    contagemAtualPorQuiosque[key] = contagemAtualPorQuiosque[key] || {};
    contagemAtualPorQuiosque[key][sku] = (contagemAtualPorQuiosque[key][sku] || 0) + quantidadeIncremento;

    const query = `
      INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
      VALUES ($1, $2, $3)
      ON CONFLICT (quiosque, sku) DO UPDATE SET quantidade = estoque_quiosque.quantidade + EXCLUDED.quantidade
    `;
    const values = [quiosqueId, sku.toLowerCase(), quantidadeIncremento];

    await pool.query(query, values);

    res.json({
      status: 'ok',
      mensagem: `SKU '${sku}' registrado para o quiosque '${quiosque}' (+${quantidadeIncremento} unidades no estoque).`,
      atual: { ...contagemAtualPorQuiosque[key] }
    });
  } catch (err) {
    console.error("Erro ao atualizar estoque:", err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar estoque.' });
  }
};
