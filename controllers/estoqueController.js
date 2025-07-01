const pool = require('../models/postgres');
const fs = require('fs');
const path = require('path');

// Página do estoque
exports.estoque = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('estoque', { user: req.session.user });
};

// Buscar estoque do quiosque da sessão (ou de outro quiosque se admin)
exports.buscarEstoquePorSessao = async (req, res) => {
  if (!req.session.user) return res.status(401).json({ erro: 'Não autenticado' });

  let quiosqueId = req.session.user.quiosque;

  if (req.session.user.admin && req.query.quiosque) {
    if (isNaN(Number(req.query.quiosque))) {
      const resultNome = await pool.query('SELECT id FROM quiosques WHERE nome = $1', [req.query.quiosque]);
      if (resultNome.rows.length === 0) return res.status(404).json({ erro: 'Quiosque não encontrado' });
      quiosqueId = resultNome.rows[0].id;
    } else {
      quiosqueId = Number(req.query.quiosque);
    }
  }

  try {
    const quiosqueNomeResult = await pool.query('SELECT nome FROM quiosques WHERE id = $1', [quiosqueId]);
    const quiosqueNome = quiosqueNomeResult.rows[0]?.nome;

    if (!quiosqueNome) {
      return res.status(404).json({ erro: 'Quiosque não encontrado' });
    }

    const estoqueResult = await pool.query(
      `SELECT sku, quantidade FROM estoque_quiosque WHERE quiosque = $1`,
      [quiosqueNome]
    );

    res.json({
      quiosque_id: quiosqueId,
      quiosque_nome: quiosqueNome,
      skus: estoqueResult.rows
    });
  } catch (err) {
    console.error('Erro ao consultar estoque:', err.message);
    res.status(500).json({ erro: 'Erro ao consultar o estoque' });
  }
};

// Listar quiosques (apenas para admins)
exports.listarQuiosques = async (req, res) => {
  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).json({ erro: 'Apenas admins podem listar os quiosques.' });
  }

  try {
    const result = await pool.query(`SELECT id, nome FROM quiosques ORDER BY nome`);
    res.json({ quiosques: result.rows });
  } catch (err) {
    console.error('Erro ao buscar quiosques:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar quiosques.' });
  }
};

// Página de conferência
exports.paginaConferencia = (req, res) => {
  res.render('conferencia', { user: req.session.user });
};

// Atualizar estoque com contagem de conferência
exports.atualizarEstoqueConferencia = async (req, res) => {
  const { quiosque_id, contador, contagem } = req.body;

  if (!quiosque_id || !contador || !contagem) {
    return res.status(400).json({ mensagem: "Dados incompletos." });
  }

  const skusBipados = Object.keys(contagem);
  const skusBipadosLower = skusBipados.map(sku => sku.toLowerCase());

  if (skusBipados.length === 0) {
    return res.status(400).json({ mensagem: "Nenhum SKU bipado para atualizar." });
  }

  const placeholders = skusBipadosLower.map((_, i) => `$${i + 1}`).join(',');

  try {
    // Verifica se os SKUs são válidos
    const precosResult = await pool.query(
      `SELECT LOWER(sku) AS sku FROM precos WHERE LOWER(sku) IN (${placeholders})`,
      skusBipadosLower
    );

    const skusValidos = precosResult.rows.map(r => r.sku);
    const skusInvalidos = skusBipadosLower.filter(sku => !skusValidos.includes(sku));

    if (skusInvalidos.length > 0) {
      return res.status(400).json({
        mensagem: "Alguns SKUs não existem na tabela de preços.",
        skusInvalidos
      });
    }

    // Buscar nome do quiosque a partir do ID
    const nomeQuiosqueResult = await pool.query('SELECT nome FROM quiosques WHERE id = $1', [quiosque_id]);
    const nomeQuiosque = nomeQuiosqueResult.rows[0]?.nome;

    if (!nomeQuiosque) {
      return res.status(404).json({ mensagem: 'Quiosque não encontrado.' });
    }

    // Buscar estoque atual
    const estoqueAntesResult = await pool.query(
      `SELECT LOWER(sku) AS sku, quantidade FROM estoque_quiosque WHERE quiosque = $1`,
      [nomeQuiosque]
    );
    const estoqueAntes = estoqueAntesResult.rows;

    // Gerar relatório
    await gerarRelatorioConferencia(nomeQuiosque, contador, contagem, estoqueAntes);

    // Atualiza o estoque substituindo o valor antigo pelo contado
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const skuOriginal of skusBipados) {
        const skuLower = skuOriginal.toLowerCase();
        const qtd = contagem[skuOriginal];

        await client.query(
          `INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
           VALUES ($1, $2, $3)
           ON CONFLICT (quiosque, sku) DO UPDATE
           SET quantidade = EXCLUDED.quantidade`,
          [nomeQuiosque, skuLower, qtd]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ mensagem: `Estoque atualizado com sucesso. Relatório salvo.` });
  } catch (err) {
    console.error("Erro ao atualizar estoque:", err);
    res.status(500).json({ mensagem: "Erro ao atualizar estoque." });
  }
};

// Gera relatório da conferência
async function gerarRelatorioConferencia(quiosque, contador, contagem, estoqueAntes) {
  const data = new Date();
  const timestamp = data.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const nomeArquivo = `conferencia-${quiosque}-${timestamp}.txt`;
  const caminho = path.join(__dirname, '../relatorios/conferencia', nomeArquivo);

  const estoqueMap = {};
  estoqueAntes.forEach(item => {
    estoqueMap[item.sku.toLowerCase()] = item.quantidade;
  });

  const contagemMap = {};
  for (const skuOriginal in contagem) {
    contagemMap[skuOriginal.toLowerCase()] = contagem[skuOriginal];
  }

  const todosSKUs = new Set([
    ...Object.keys(estoqueMap),
    ...Object.keys(contagemMap),
  ]);

  let conteudo = `RELATÓRIO DE CONFERÊNCIA DE ESTOQUE\n`;
  conteudo += `Quiosque: ${quiosque}\nContador(a): ${contador}\nData: ${data.toLocaleString()}\n\n`;
  conteudo += `${'SKU'.padEnd(30)}${'Contado'.padEnd(10)}${'Anterior'.padEnd(10)}Observação\n`;
  conteudo += `${'-'.repeat(65)}\n`;

  for (const sku of todosSKUs) {
    const contado = contagemMap[sku] ?? '-';
    const anterior = estoqueMap[sku] ?? '-';

    let obs = '';
    if (contagemMap[sku] !== undefined && estoqueMap[sku] !== undefined) {
      obs = '✓ Atualizado';
      if (typeof contado === 'number' && typeof anterior === 'number') {
        if (contado > anterior) obs += ' ▲ Aumentou';
        else if (contado < anterior) obs += ' ▼ Diminuiu';
      }
    } else if (contagemMap[sku] !== undefined) {
      obs = '➕ Novo SKU';
    } else if (estoqueMap[sku] !== undefined) {
      obs = '⏸️ Não bipado';
    }

    conteudo += `${sku.padEnd(30)}${String(contado).padEnd(10)}${String(anterior).padEnd(10)}${obs}\n`;
  }

  await fs.promises.writeFile(caminho, conteudo, 'utf-8');
  return nomeArquivo;
}
