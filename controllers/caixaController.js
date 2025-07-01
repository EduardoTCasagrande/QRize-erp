const path = require('path');
const fs = require('fs');
const pool = require('../models/postgres');
const { DateTime } = require('luxon');

exports.getCaixaTotal = async (req, res) => {
  const quiosque_id = Number(req.params.quiosque);

  if (isNaN(quiosque_id)) {
    return res.status(400).json({ erro: 'ID do quiosque inválido.' });
  }

  try {
    const ajusteResult = await pool.query(`
      SELECT valor, data 
      FROM caixa_movimentos
      WHERE quiosque_id = $1 AND forma_pagamento = 'ajuste'
      ORDER BY data DESC
      LIMIT 1
    `, [quiosque_id]);

    const ajuste = ajusteResult.rows[0];

    if (ajuste) {
      const movimentosResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total_mov
        FROM caixa_movimentos
        WHERE quiosque_id = $1 AND data > $2
      `, [quiosque_id, ajuste.data]);

      const totalMov = Number(movimentosResult.rows[0].total_mov) || 0;
      const totalFinal = Number(ajuste.valor) + totalMov;

      return res.json({ total: totalFinal });
    } else {
      const totalResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total
        FROM caixa_movimentos
        WHERE quiosque_id = $1
      `, [quiosque_id]);

      const total = Number(totalResult.rows[0].total) || 0;
      return res.json({ total });
    }
  } catch (err) {
    console.error('Erro ao buscar total do caixa:', err.message);
    return res.status(500).json({ erro: 'Erro ao buscar total do caixa.' });
  }
};

exports.getHistoricoCaixa = async (req, res) => {
  const quiosque_id = Number(req.params.quiosque);

  if (isNaN(quiosque_id)) {
    return res.status(400).json({ erro: 'ID do quiosque inválido.' });
  }

  try {
    const result = await pool.query(`
      SELECT id, valor, forma_pagamento, data
      FROM caixa_movimentos
      WHERE quiosque_id = $1
      ORDER BY data DESC
    `, [quiosque_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar histórico do caixa:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar histórico do caixa.' });
  }
};

exports.registrarSangria = async (req, res) => {
  const { quiosque, valor } = req.body;
  const quiosque_id = Number(quiosque);

  if (isNaN(quiosque_id) || typeof valor !== 'number' || valor <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos. Informe quiosque e valor numérico positivo.' });
  }

  const valorNegativo = -Math.abs(valor);
  const dataBrasilia = DateTime.now().setZone('America/Sao_Paulo').toISO();

  try {
    const result = await pool.query(`
      INSERT INTO caixa_movimentos (quiosque_id, valor, forma_pagamento, data)
      VALUES ($1, $2, 'sangria', $3)
      RETURNING id
    `, [quiosque_id, valorNegativo, dataBrasilia]);

    res.json({ mensagem: 'Sangria registrada com sucesso!', id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao registrar sangria:', err.message);
    res.status(500).json({ erro: 'Erro ao registrar sangria.' });
  }
};

exports.renderSangriaPage = (req, res) => {
  const user = req.session.user;
  res.render('sangria', { user });
};

exports.gerarRelatorioDoDia = async (req, res) => {
  const quiosque_id = Number(req.params.quiosque);

  if (isNaN(quiosque_id)) {
    return res.status(400).json({ erro: 'ID do quiosque inválido.' });
  }

  const relatoriosDir = path.join(__dirname, '..', 'relatorios', 'fechamento');

  try {
    if (!fs.existsSync(relatoriosDir)) {
      fs.mkdirSync(relatoriosDir, { recursive: true });
    }

    const statusResult = await pool.query(`
      SELECT data_abertura FROM caixa_status 
      WHERE quiosque_id = $1 AND aberto = true
    `, [quiosque_id]);

    if (statusResult.rows.length === 0) {
      return res.status(400).json({ erro: 'Caixa não está aberto para esse quiosque.' });
    }

    const dataAbertura = statusResult.rows[0].data_abertura;

    const totalsResult = await pool.query(`
      SELECT LOWER(TRIM(forma_pagamento)) AS tipo, SUM(valor) AS total
      FROM caixa_movimentos
      WHERE quiosque_id = $1 AND data >= $2
      GROUP BY tipo
    `, [quiosque_id, dataAbertura]);

    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCartao = 0;
    let totalSangria = 0;

    totalsResult.rows.forEach(row => {
      const tipo = row.tipo;
      const total = Number(row.total);

      if (tipo === 'dinheiro') totalDinheiro += total;
      else if (tipo === 'pix') totalPix += total;
      else if (tipo === 'cartão' || tipo === 'cartao') totalCartao += total;
      else if (tipo === 'sangria') totalSangria += Math.abs(total);
    });

    const saldoResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN forma_pagamento = 'dinheiro' THEN valor ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN forma_pagamento = 'sangria' THEN valor ELSE 0 END), 0) AS total_dinheiro_caixa
      FROM caixa_movimentos
      WHERE quiosque_id = $1
    `, [quiosque_id]);

    const saldoAtualCaixa = Number(saldoResult.rows[0].total_dinheiro_caixa) || 0;

    let conteudo = `Fechamento de Caixa\n\n`;
    conteudo += `Vendas por Forma de Pagamento:\n`;
    conteudo += `- Dinheiro: R$ ${totalDinheiro.toFixed(2).replace('.', ',')}\n`;
    conteudo += `- Pix: R$ ${totalPix.toFixed(2).replace('.', ',')}\n`;
    conteudo += `- Cartão: R$ ${totalCartao.toFixed(2).replace('.', ',')}\n`;
    conteudo += `Sangrias: R$ ${Math.abs(totalSangria).toFixed(2).replace('.', ',')}\n\n`;
    conteudo += `Total vendido em dinheiro no dia: R$ ${totalDinheiro.toFixed(2).replace('.', ',')}\n\n`;
    conteudo += `SALDO ATUAL NO CAIXA: R$ ${saldoAtualCaixa.toFixed(2).replace('.', ',')}\n`;

    const dataHoje = DateTime.now().setZone('America/Sao_Paulo').toISODate();
    const nomeArquivo = `relatorio_${quiosque_id}_${dataHoje}.txt`;
    const caminhoArquivo = path.join(relatoriosDir, nomeArquivo);

    if (fs.existsSync(caminhoArquivo)) {
      const anterior = fs.readFileSync(caminhoArquivo, 'utf-8');
      fs.writeFileSync(caminhoArquivo, '\n' + conteudo + anterior, 'utf-8');
    } else {
      fs.writeFileSync(caminhoArquivo, conteudo, 'utf-8');
    }

    res.json({
      mensagem: 'Relatório de fechamento gerado com sucesso!',
      arquivo: nomeArquivo,
      url: `/relatorios/fechamento/${encodeURIComponent(nomeArquivo)}?tipo=fechamento&raw=true`
    });

  } catch (err) {
    console.error('Erro ao gerar relatório:', err.message);
    res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
};

exports.abrirCaixa = async (req, res) => {
  const { quiosque, valor_inicial } = req.body;
  const quiosque_id = Number(quiosque);

  if (isNaN(quiosque_id) || typeof valor_inicial !== 'number' || valor_inicial < 0) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  const agora = DateTime.now().setZone('America/Sao_Paulo').toISO();

  try {
    await pool.query(`
      INSERT INTO caixa_status (quiosque_id, aberto, valor_inicial, data_abertura, data_fechamento)
      VALUES ($1, true, $2, $3, NULL)
      ON CONFLICT (quiosque_id) DO UPDATE SET 
        aberto = true,
        valor_inicial = EXCLUDED.valor_inicial,
        data_abertura = EXCLUDED.data_abertura,
        data_fechamento = NULL
    `, [quiosque_id, valor_inicial, agora]);

    const relatoriosDir = path.join(__dirname, '..', 'relatorios', 'fechamento');
    if (!fs.existsSync(relatoriosDir)) fs.mkdirSync(relatoriosDir, { recursive: true });

    const dataHoje = DateTime.now().setZone('America/Sao_Paulo').toISODate();
    const nomeArquivo = `relatorio_${quiosque_id}_${dataHoje}.txt`;
    const caminhoArquivo = path.join(relatoriosDir, nomeArquivo);

    const conteudoAbertura =
      `Abertura de Caixa\n` +
      `Quiosque ID: ${quiosque_id}\n` +
      `Valor Inicial: R$ ${valor_inicial.toFixed(2).replace('.', ',')}\n` +
      `Data: ${DateTime.now().setZone('America/Sao_Paulo').toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)}\n\n`;

    if (fs.existsSync(caminhoArquivo)) {
      const anterior = fs.readFileSync(caminhoArquivo, 'utf-8');
      fs.writeFileSync(caminhoArquivo, conteudoAbertura + anterior, 'utf-8');
    } else {
      fs.writeFileSync(caminhoArquivo, conteudoAbertura, 'utf-8');
    }

    res.json({ mensagem: 'Caixa aberto com sucesso!' });

  } catch (err) {
    console.error('Erro ao abrir caixa:', err.message);
    res.status(500).json({ erro: 'Erro ao abrir caixa.' });
  }
};

exports.fecharCaixa = async (req, res) => {
  const { quiosque } = req.body;
  const quiosque_id = Number(quiosque);

  if (isNaN(quiosque_id)) return res.status(400).json({ erro: 'Quiosque não informado.' });

  const agora = DateTime.now().setZone('America/Sao_Paulo').toISO();

  try {
    const result = await pool.query(`
      UPDATE caixa_status
      SET aberto = false, data_fechamento = $1
      WHERE quiosque_id = $2
    `, [agora, quiosque_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Caixa não encontrado para esse quiosque.' });
    }

    res.json({ mensagem: 'Caixa fechado com sucesso.' });

  } catch (err) {
    console.error('Erro ao fechar caixa:', err.message);
    res.status(500).json({ erro: 'Erro ao fechar caixa.' });
  }
};

exports.verificarStatusCaixa = async (req, res) => {
  const quiosque_id = Number(req.params.quiosque);

  if (isNaN(quiosque_id)) {
    return res.status(400).json({ erro: 'ID do quiosque inválido.' });
  }

  try {
    const result = await pool.query(`
      SELECT aberto, valor_inicial, data_abertura, data_fechamento
      FROM caixa_status
      WHERE quiosque_id = $1
    `, [quiosque_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Caixa não encontrado para esse quiosque.' });
    }

    const row = result.rows[0];
    res.json({
      aberto: row.aberto,
      valor_inicial: row.valor_inicial,
      data_abertura: row.data_abertura,
      data_fechamento: row.data_fechamento
    });
  } catch (err) {
    console.error('Erro ao verificar status do caixa:', err.message);
    res.status(500).json({ erro: 'Erro ao consultar status do caixa.' });
  }
};

exports.ajustarSaldoCaixa = async (req, res) => {
  const { quiosque, valor } = req.body;
  const quiosque_id = Number(quiosque);

  if (isNaN(quiosque_id) || typeof valor !== 'number') {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  const dataBrasilia = DateTime.now().setZone('America/Sao_Paulo').toISO();

  try {
    await pool.query(`
      INSERT INTO caixa_movimentos (quiosque_id, valor, forma_pagamento, data)
      VALUES ($1, $2, 'ajuste', $3)
    `, [quiosque_id, valor, dataBrasilia]);

    res.json({ mensagem: `Saldo do caixa ajustado em R$ ${valor.toFixed(2).replace('.', ',')}` });
  } catch (err) {
    console.error('Erro ao ajustar saldo do caixa:', err.message);
    res.status(500).json({ erro: 'Erro ao ajustar saldo do caixa.' });
  }
};
