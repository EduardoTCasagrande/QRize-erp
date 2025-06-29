const db = require('../models/db');
const path = require('path');
const fs = require('fs');

exports.vendasPage = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('vendas');
};

exports.vender = (req, res) => {
  const { quiosque, venda, pagamentos, total, desconto, operador, itensPromocionais } = req.body;

  if (!quiosque || !venda || typeof venda !== 'object' || !Array.isArray(pagamentos) || typeof total !== 'number') {
    return res.status(400).json({
      status: 'erro',
      mensagem: 'Dados da venda inválidos.'
    });
  }

  db.get(`SELECT MAX(id_venda) as ultimo FROM historico_transacoes`, (err, row) => {
    if (err) {
      console.error('Erro ao buscar último id_venda:', err.message);
      return res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao gerar ID de venda.' });
    }

    const idVendaAtual = (row.ultimo || 0) + 1;
    salvarItensDaVenda(idVendaAtual);
  });

  function salvarItensDaVenda(idVendaAtual) {
    const stmt = db.prepare(`
      INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
      VALUES (?, ?, ?)
      ON CONFLICT(quiosque, sku)
      DO UPDATE SET quantidade = quantidade - ?
    `);

    const historicoStmt = db.prepare(`
      INSERT INTO historico_transacoes (id_venda, tipo, quiosque, sku, quantidade, valor, operador)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const getPreco = db.prepare(`SELECT preco FROM precos WHERE sku = ?`);

    const skus = Object.entries(venda).filter(([sku, quantidade]) => sku && quantidade && quantidade > 0);
    let pendentes = skus.length;
    let vendaDetalhada = [];

    skus.forEach(([sku, quantidade]) => {
      getPreco.get([sku], (err, row) => {
        let precoUnitario = row ? row.preco : 0;

        // Se o SKU estiver marcado como promocional, vender por R$ 0,01
        if (itensPromocionais && itensPromocionais[sku]) {
          precoUnitario = 0.01;
        }

        const valorTotalItem = precoUnitario * quantidade;

        vendaDetalhada.push({ sku, quantidade, precoUnitario, valorTotalItem });

        stmt.run([quiosque, sku, quantidade * -1, quantidade], (err) => {
          if (err) console.error("Erro ao atualizar estoque:", err.message);
        });

        historicoStmt.run([idVendaAtual, 'venda', quiosque, sku, quantidade, valorTotalItem, operador || 'desconhecido'], (err) => {
          if (err) console.error("Erro ao salvar no histórico:", err.message);
        });

        pendentes--;
        if (pendentes === 0) finalizar();
      });
    });

    function finalizar() {
      stmt.finalize();
      historicoStmt.finalize();
      getPreco.finalize();

      const agora = new Date().toLocaleString('sv-SE').replace(' ', ' '); // formato: 'YYYY-MM-DD HH:MM:SS'

      const caixaStmt = db.prepare(`
        INSERT INTO caixa_movimentos (quiosque, valor, forma_pagamento, data)
        VALUES (?, ?, ?, ?)
      `);

      pagamentos.forEach(({ forma, valor }) => {
        caixaStmt.run([quiosque, valor, forma.toLowerCase(), agora], (err) => {
          if (err) console.error(`Erro ao registrar no caixa (forma: ${forma}):`, err.message);
        });
      });


      caixaStmt.finalize();

      const nomeArquivo = gerarCupomESC(quiosque, vendaDetalhada, total, desconto, pagamentos, operador, idVendaAtual);

      res.json({
        status: 'ok',
        mensagem: `Venda #${idVendaAtual} finalizada com sucesso.`,
        id_venda: idVendaAtual,
        cupomUrl: `/cupons/${nomeArquivo}`
      });
    }
  }

  function gerarCupomESC(quiosque, itens, total, desconto, pagamentos, operador, idVendaAtual) {
    const cuponsDir = path.join(__dirname, '../cupons');
    if (!fs.existsSync(cuponsDir)) {
      fs.mkdirSync(cuponsDir);
    }

    const data = new Date();
    const nomeArquivo = `cupom_${quiosque}_${data.getTime()}.esc`;
    const filePath = path.join(cuponsDir, nomeArquivo);

    let conteudo = '';
    conteudo += '*** CUPOM PDV ***\n';
    conteudo += `Venda Nº: ${idVendaAtual}\n`;
    conteudo += `Quiosque: ${quiosque}\n`;
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
};

exports.renderHistoricoPage = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('historico');
};

exports.historico = (req, res) => {
  const { data_inicio, data_fim, quiosque } = req.query;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({
      status: 'erro',
      mensagem: 'Parâmetros "data_inicio" e "data_fim" são obrigatórios.'
    });
  }

  let sql = `
    SELECT id_venda, tipo, quiosque, sku, quantidade, valor, operador, data
    FROM historico_transacoes
    WHERE tipo = 'venda' AND date(data) BETWEEN date(?) AND date(?)
  `;
  const params = [data_inicio, data_fim];

  if (quiosque) {
    sql += ' AND quiosque = ?';
    params.push(quiosque);
  }

  sql += ' ORDER BY id_venda ASC, data ASC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao consultar histórico:', err.message);
      return res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao buscar histórico de vendas.'
      });
    }

    res.json({
      status: 'ok',
      historico: rows
    });
  });
};
