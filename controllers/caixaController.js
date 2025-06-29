// controllers/caixaController.js
const db = require('../models/db');
const path = require('path');
const fs = require('fs');


exports.getCaixaTotal = (req, res) => {
  const { quiosque } = req.params;

  db.get(`
    SELECT valor, data FROM caixa_movimentos
    WHERE quiosque = ? AND forma_pagamento = 'ajuste'
    ORDER BY datetime(data) DESC
    LIMIT 1
  `, [quiosque], (err, ajuste) => {
    if (err) {
      console.error('Erro ao buscar ajuste:', err.message);
      return res.status(500).json({ erro: 'Erro ao buscar ajuste.' });
    }

    if (ajuste) {
      // Se houver ajuste, somar os movimentos posteriores a ele
      db.get(`
        SELECT 
          COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total_mov
        FROM caixa_movimentos
        WHERE quiosque = ? AND datetime(data) > datetime(?)
      `, [quiosque, ajuste.data], (errMov, rowMov) => {
        if (errMov) {
          console.error('Erro ao somar após ajuste:', errMov.message);
          return res.status(500).json({ erro: 'Erro ao calcular saldo após ajuste.' });
        }

        const totalFinal = ajuste.valor + (rowMov.total_mov || 0);
        return res.json({ total: totalFinal });
      });
    } else {
      // Sem ajuste? Soma todos normalmente
      db.get(`
        SELECT 
          COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total
        FROM caixa_movimentos
        WHERE quiosque = ?
      `, [quiosque], (errMov, rowMov) => {
        if (errMov) {
          console.error('Erro ao buscar movimentos:', errMov.message);
          return res.status(500).json({ erro: 'Erro ao calcular saldo.' });
        }

        res.json({ total: rowMov.total ?? 0 });
      });
    }
  });
};





exports.getHistoricoCaixa = (req, res) => {
  const { quiosque } = req.params;

  db.all(`
    SELECT id, valor, forma_pagamento, data
    FROM caixa_movimentos
    WHERE quiosque = ?
    ORDER BY data DESC
  `, [quiosque], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar histórico do caixa:', err.message);
      return res.status(500).json({ erro: 'Erro ao buscar histórico do caixa.' });
    }

    res.json(rows);
  });
};

exports.registrarSangria = (req, res) => {
  const { quiosque, valor } = req.body;

  if (!quiosque || typeof valor !== 'number' || valor <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos. Informe quiosque e valor numérico positivo.' });
  }

  const valorNegativo = -Math.abs(valor); 

  db.run(`
    INSERT INTO caixa_movimentos (quiosque, valor, forma_pagamento)
    VALUES (?, ?, ?)
  `, [quiosque, valorNegativo, 'sangria'], function(err) {
    if (err) {
      console.error('Erro ao registrar sangria:', err.message);
      return res.status(500).json({ erro: 'Erro ao registrar sangria.' });
    }

    res.json({ mensagem: 'Sangria registrada com sucesso!', id: this.lastID });
  });
};
exports.renderSangriaPage = (req, res) => {
  const user = req.session.user;
  res.render('sangria', { user });
};


const relatoriosDir = path.join(__dirname, '..', 'relatorios', 'fechamento');

exports.gerarRelatorioDoDia = (req, res) => {
  const { quiosque } = req.params;

  const relatoriosDir = path.join(__dirname, '..', 'relatorios', 'fechamento');
  if (!fs.existsSync(relatoriosDir)) {
    fs.mkdirSync(relatoriosDir, { recursive: true });
  }

  db.get(`
    SELECT data_abertura FROM caixa_status 
    WHERE quiosque = ? AND aberto = 1
  `, [quiosque], (erroCaixa, resultado) => {
    if (erroCaixa) {
      console.error('Erro ao buscar status do caixa:', erroCaixa.message);
      return res.status(500).json({ erro: 'Erro ao buscar status do caixa.' });
    }

    if (!resultado || !resultado.data_abertura) {
      return res.status(400).json({ erro: 'Caixa não está aberto para esse quiosque.' });
    }

    const dataAbertura = resultado.data_abertura;

    db.all(`
      SELECT forma_pagamento, SUM(valor) as total
      FROM caixa_movimentos
      WHERE quiosque = ? AND datetime(data) >= datetime(?)
      GROUP BY forma_pagamento
    `, [quiosque, dataAbertura], (err, rows) => {
      if (err) {
        console.error('Erro ao gerar relatório:', err.message);
        return res.status(500).json({ erro: 'Erro ao gerar relatório.' });
      }

      let totalDinheiro = 0;
      let totalPix = 0;
      let totalCartao = 0;
      let totalSangria = 0;

      rows.forEach(row => {
        const tipo = row.forma_pagamento.trim().toLowerCase();
        const total = Number(row.total);

        if (tipo === 'dinheiro') totalDinheiro += total;
        else if (tipo === 'pix') totalPix += total;
        else if (tipo === 'cartão' || tipo === 'cartao') totalCartao += total;
        else if (tipo === 'sangria') totalSangria += total;
      });

      db.get(`
        SELECT 
          COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total_dinheiro_caixa
        FROM caixa_movimentos
        WHERE quiosque = ?
      `, [quiosque], (errSaldo, rowSaldo) => {
        if (errSaldo) {
          console.error('Erro ao buscar saldo atual do caixa:', errSaldo.message);
          return res.status(500).json({ erro: 'Erro ao buscar saldo atual do caixa.' });
        }

        const saldoAtualCaixa = Number(rowSaldo.total_dinheiro_caixa) || 0;

        let conteudo = `Fechamento de Caixa\n\n`;
        conteudo += `Vendas por Forma de Pagamento:\n`;
        conteudo += `- Dinheiro: R$ ${totalDinheiro.toFixed(2).replace('.', ',')}\n`;
        conteudo += `- Pix: R$ ${totalPix.toFixed(2).replace('.', ',')}\n`;
        conteudo += `- Cartão: R$ ${totalCartao.toFixed(2).replace('.', ',')}\n`;
        conteudo += `Sangrias: R$ ${Math.abs(totalSangria).toFixed(2).replace('.', ',')}\n\n`;
        conteudo += `Total vendido em dinheiro no dia: R$ ${totalDinheiro.toFixed(2).replace('.', ',')}\n\n`;
        conteudo += `SALDO ATUAL NO CAIXA: R$ ${saldoAtualCaixa.toFixed(2).replace('.', ',')}\n`;

        const dataHoje = new Date().toISOString().split('T')[0];
        const nomeArquivo = `relatorio_${quiosque.replace(/[^a-zA-Z0-9-_]/g, '-')}_${dataHoje}.txt`;
        const caminhoArquivo = path.join(relatoriosDir, nomeArquivo);

        try {
          fs.appendFileSync(caminhoArquivo, '\n' + conteudo, 'utf-8');
          res.json({
            mensagem: 'Relatório de fechamento gerado com sucesso!',
            arquivo: nomeArquivo,
            url: `/relatorios/fechamento/${encodeURIComponent(nomeArquivo)}?tipo=fechamento&raw=true`
          });
        } catch (err) {
          console.error('Erro ao salvar relatório de fechamento:', err);
          res.status(500).json({ erro: 'Erro ao salvar relatório.' });
        }
      });
    });
  });
};

// controllers/caixaController.js
exports.abrirCaixa = (req, res) => {
  const { quiosque, valor_inicial } = req.body;

  if (!quiosque || typeof valor_inicial !== 'number' || valor_inicial < 0) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  const agora = new Date().toLocaleString('sv-SE'); // Ex: 2025-06-25 08:31:12

  db.run(`
    INSERT INTO caixa_status (quiosque, aberto, valor_inicial, data_abertura, data_fechamento)
    VALUES (?, 1, ?, ?, NULL)
    ON CONFLICT(quiosque) DO UPDATE SET 
      aberto = 1,
      valor_inicial = excluded.valor_inicial,
      data_abertura = excluded.data_abertura,
      data_fechamento = NULL
  `, [quiosque, valor_inicial, agora], function (err) {
    if (err) {
      console.error('Erro ao abrir caixa:', err.message);
      return res.status(500).json({ erro: 'Erro ao abrir caixa.' });
    }

    // >>> Gera/atualiza o relatório com a abertura
    try {
      const relatoriosDir = path.join(__dirname, '..', 'relatorios', 'fechamento');
      fs.mkdirSync(relatoriosDir, { recursive: true });

      const dataHoje = new Date().toISOString().split('T')[0]; // ex: 2025-06-25
      const nomeArquivo = `relatorio_${quiosque.replace(/[^a-zA-Z0-9-_]/g, '-')}_${dataHoje}.txt`;
      const caminhoArquivo = path.join(relatoriosDir, nomeArquivo);

      const conteudoAbertura =
        `Abertura de Caixa\n` +
        `Quiosque: ${quiosque}\n` +
        `Valor Inicial: R$ ${valor_inicial.toFixed(2).replace('.', ',')}\n` +
        `Data: ${new Date().toLocaleString('pt-BR')}\n\n`;

      if (fs.existsSync(caminhoArquivo)) {
        const anterior = fs.readFileSync(caminhoArquivo, 'utf-8');
        fs.writeFileSync(caminhoArquivo, conteudoAbertura + anterior, 'utf-8');
      } else {
        fs.writeFileSync(caminhoArquivo, conteudoAbertura, 'utf-8');
      }

    } catch (errEscrita) {
      console.error('Erro ao salvar relatório de abertura do caixa:', errEscrita.message);
    }

    res.json({ mensagem: 'Caixa aberto com sucesso!' });
  });
};

exports.fecharCaixa = (req, res) => {
  const { quiosque } = req.body;
  if (!quiosque) return res.status(400).json({ erro: 'Quiosque não informado.' });

  const agora = new Date().toLocaleString('sv-SE'); // Ex: 2025-06-25 08:31:12

  db.run(`
    UPDATE caixa_status
    SET aberto = 0, data_fechamento = ?
    WHERE quiosque = ?
  `, [agora, quiosque], function(err) {
    if (err) {
      console.error('Erro ao fechar caixa:', err.message);
      return res.status(500).json({ erro: 'Erro ao fechar caixa.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ erro: 'Caixa não encontrado para esse quiosque.' });
    }

    res.json({ mensagem: 'Caixa fechado com sucesso.' });
  });
};
exports.verificarStatusCaixa = (req, res) => {
  const { quiosque } = req.params;

  db.get(`
    SELECT aberto, valor_inicial, data_abertura, data_fechamento
    FROM caixa_status
    WHERE quiosque = ?
  `, [quiosque], (err, row) => {
    if (err) {
      console.error('Erro ao verificar status do caixa:', err.message);
      return res.status(500).json({ erro: 'Erro ao consultar status do caixa.' });
    }

    if (!row) {
      return res.status(404).json({ erro: 'Caixa não encontrado para esse quiosque.' });
    }

    res.json({
      aberto: !!row.aberto,
      valor_inicial: row.valor_inicial,
      data_abertura: row.data_abertura,
      data_fechamento: row.data_fechamento
    });
  });
};

exports.ajustarSaldoCaixa = (req, res) => {
  const { quiosque, valor, descricao } = req.body;

  if (!quiosque || typeof valor !== 'number') {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  // Definir a forma de pagamento como 'ajuste' ou outro termo que preferir
  const formaPagamento = 'ajuste';

  db.run(`
    INSERT INTO caixa_movimentos (quiosque, valor, forma_pagamento)
    VALUES (?, ?, ?)
  `, [quiosque, valor, formaPagamento], function(err) {
    if (err) {
      console.error('Erro ao ajustar saldo do caixa:', err.message);
      return res.status(500).json({ erro: 'Erro ao ajustar saldo do caixa.' });
    }

    res.json({ mensagem: `Saldo do caixa ajustado em R$ ${valor.toFixed(2).replace('.', ',')}` });
  });
};
