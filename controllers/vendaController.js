const db = require('../models/postgres'); // seu pool pg com método query async
const path = require('path');
const fs = require('fs');

exports.vendasPage = (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('vendas');
};

exports.vender = async (req, res) => {
  const {
    quiosque_id, // ALTERAÇÃO: espera-se que o front envie o id aqui
    venda,
    pagamentos,
    total,
    desconto,
    operador,
    itensPromocionais
  } = req.body;

  if (
    !quiosque_id ||
    !venda ||
    typeof venda !== 'object' ||
    !Array.isArray(pagamentos) ||
    typeof total !== 'number'
  ) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados da venda inválidos.' });
  }

  try {
    const ultimoResult = await db.query('SELECT MAX(id_venda) as ultimo FROM historico_transacoes');
    const idVendaAtual = (ultimoResult.rows[0].ultimo || 0) + 1;

    const skus = Object.entries(venda).filter(([sku, qtd]) => sku && qtd && qtd > 0);
    const vendaDetalhada = [];

    await db.query('BEGIN');

    for (const [sku, quantidade] of skus) {
      const precoResult = await db.query('SELECT preco FROM precos WHERE sku = $1', [sku]);
      let precoUnitario = precoResult.rows[0] ? precoResult.rows[0].preco : 0;

      if (itensPromocionais && itensPromocionais[sku]) {
        precoUnitario = 0.01;
      }

      const valorTotalItem = precoUnitario * quantidade;
      vendaDetalhada.push({ sku, quantidade, precoUnitario, valorTotalItem });

      // Atualiza estoque (subtrai quantidade)
      await db.query(`
        INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
        VALUES ($1, $2, $3)
        ON CONFLICT (quiosque, sku)
        DO UPDATE SET quantidade = estoque_quiosque.quantidade - EXCLUDED.quantidade
      `, [quiosque_id, sku, quantidade]);

      // Insere no histórico de transações
      await db.query(`
        INSERT INTO historico_transacoes (id_venda, tipo, quiosque_id, sku, quantidade, valor, operador)
        VALUES ($1, 'venda', $2, $3, $4, $5, $6)
      `, [idVendaAtual, quiosque_id, sku, quantidade, valorTotalItem, operador || 'desconhecido']);
    }

    // Registrar pagamentos no caixa
    const agora = new Date().toISOString();
    for (const { forma, valor } of pagamentos) {
      await db.query(`
        INSERT INTO caixa_movimentos (quiosque_id, valor, forma_pagamento, data)
        VALUES ($1, $2, $3, $4)
      `, [quiosque_id, valor, forma.toLowerCase(), agora]);
    }

    await db.query('COMMIT');

    // Gerar cupom ESC
    const nomeArquivo = gerarCupomESC(quiosque_id, vendaDetalhada, total, desconto, pagamentos, operador, idVendaAtual);

    res.json({
      status: 'ok',
      mensagem: `Venda #${idVendaAtual} finalizada com sucesso.`,
      id_venda: idVendaAtual,
      cupomUrl: `/cupons/${nomeArquivo}`
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Erro ao processar venda:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao processar venda.' });
  }
};

function gerarCupomESC(quiosque_id, itens, total, desconto, pagamentos, operador, idVendaAtual) {
  const cuponsDir = path.join(__dirname, '../cupons');
  if (!fs.existsSync(cuponsDir)) {
    fs.mkdirSync(cuponsDir);
  }

  const data = new Date();
  const nomeArquivo = `cupom_${quiosque_id}_${data.getTime()}.esc`;
  const filePath = path.join(cuponsDir, nomeArquivo);

  let conteudo = '';
  conteudo += '*** CUPOM PDV ***\n';
  conteudo += `Venda Nº: ${idVendaAtual}\n`;
  conteudo += `Quiosque ID: ${quiosque_id}\n`;
  conteudo += `Data: ${data.toLocaleString()}\n`;
  conteudo += `Operador: ${operador || 'desconhecido'}\n\n`;

  itens.forEach(item => {
    conteudo += `SKU: ${item.sku} | Qtd: ${item.quantidade} | R$: ${item.precoUnitario.toFixed(2)}\n`;
  });

  conteudo += `\nTotal: R$ ${total.toFixed(2)}\n`;
  if (desconto && desconto > 0) {
    conteudo += `Desconto: R$ ${desconto.toFixed(2)}\n`;
  }

  conteudo += '\nPagamentos:\n';
  pagamentos.forEach(p => {
    conteudo += `- ${p.forma}: R$ ${p.valor.toFixed(2)}\n`;
  });

  conteudo += '\nObrigado pela preferência!\n';

  fs.writeFileSync(filePath, conteudo, 'utf8');
  return nomeArquivo;
}

exports.renderHistoricoPage = (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('historico');
};

exports.historico = async (req, res) => {
  const { data_inicio, data_fim, quiosque_id } = req.query;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({
      status: 'erro',
      mensagem: 'Parâmetros "data_inicio" e "data_fim" são obrigatórios.'
    });
  }

  try {
    let sql = `
      SELECT id_venda, tipo, quiosque_id, sku, quantidade, valor, operador, data
      FROM historico_transacoes
      WHERE tipo = 'venda' AND data::date BETWEEN $1 AND $2
    `;
    const params = [data_inicio, data_fim];

    if (quiosque_id) {
      sql += ' AND quiosque_id = $3';
      params.push(quiosque_id);
    }

    sql += ' ORDER BY id_venda ASC, data ASC';

    const result = await db.query(sql, params);

    res.json({ status: 'ok', historico: result.rows });
  } catch (err) {
    console.error('Erro ao consultar histórico:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao buscar histórico de vendas.' });
  }
};
