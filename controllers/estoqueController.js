const db = require('../models/db');
const fs = require('fs');
const path = require('path');

exports.estoque = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('estoque', 
    { user: req.session.user }
  );
};


exports.buscarEstoquePorSessao = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  const user = req.session.user;
  let quiosqueFinal = user.quiosque;

  // Se for admin e passar um quiosque via query param, permite consultar qualquer quiosque
  if (user.admin && req.query.quiosque) {
    quiosqueFinal = req.query.quiosque;
  }

  db.all(
    `SELECT sku, quantidade FROM estoque_quiosque WHERE quiosque = ?`,
    [quiosqueFinal],
    (err, rows) => {
      if (err) {
        console.error("Erro ao consultar estoque:", err.message);
        return res.status(500).json({ erro: 'Erro ao consultar o estoque' });
      }

      res.json({ quiosque: quiosqueFinal, skus: rows });
    }
  );
};

// Nova rota para listar quiosques (usada no <select>)
exports.listarQuiosques = (req, res) => {
  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).json({ erro: 'Apenas admins podem listar os quiosques.' });
  }

  db.all(`SELECT nome FROM quiosques`, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar quiosques:', err.message);
      return res.status(500).json({ erro: 'Erro ao buscar quiosques.' });
    }

    const nomes = rows.map(r => r.nome);
    res.json({ quiosques: nomes });
  });
};

// Garante que a pasta exista
const pastaRelatorios = path.join(__dirname, '../relatorios/conferencia');
if (!fs.existsSync(pastaRelatorios)) {
  fs.mkdirSync(pastaRelatorios, { recursive: true });
}

exports.paginaConferencia = (req, res) => {
  res.render('conferencia', { user: req.session.user });
};

exports.atualizarEstoqueConferencia = (req, res) => {
  const { quiosque, contador, contagem } = req.body;

  if (!quiosque || !contador || !contagem) {
    return res.status(400).json({ mensagem: "Dados incompletos." });
  }

  const skusBipados = Object.keys(contagem);
  const skusBipadosLower = skusBipados.map(sku => sku.toLowerCase());

  if (skusBipados.length === 0) {
    return res.status(400).json({ mensagem: "Nenhum SKU bipado para atualizar." });
  }

  const placeholders = skusBipadosLower.map(() => '?').join(',');

  // Verifica SKUs válidos na tabela precos
  db.all(
    `SELECT LOWER(sku) AS sku FROM precos WHERE LOWER(sku) IN (${placeholders})`,
    skusBipadosLower,
    (err, rows) => {
      if (err) {
        console.error("Erro ao verificar SKUs válidos:", err);
        return res.status(500).json({ mensagem: "Erro ao verificar SKUs válidos." });
      }

      const skusValidos = rows.map(r => r.sku);
      const skusInvalidos = skusBipadosLower.filter(sku => !skusValidos.includes(sku));

      if (skusInvalidos.length > 0) {
        return res.status(400).json({
          mensagem: "Alguns SKUs não existem na tabela de preços.",
          skusInvalidos
        });
      }

      // Busca estoque atual antes da atualização
      db.all(
        `SELECT LOWER(sku) AS sku, quantidade FROM estoque_quiosque WHERE quiosque = ?`,
        [quiosque],
        (err, estoqueAntes) => {
          if (err) {
            console.error("Erro ao buscar estoque antigo:", err);
            return res.status(500).json({ mensagem: "Erro ao buscar estoque anterior." });
          }

          // Gera relatório primeiro (usando os dados atuais)
          gerarRelatorioConferencia(quiosque, contador, contagem, estoqueAntes, (err, nomeArquivo) => {
            if (err) {
              console.error("Erro ao gerar relatório:", err);
              return res.status(500).json({ mensagem: "Erro ao salvar relatório." });
            }

            // Atualiza ou insere apenas os SKUs bipados
            const promessasAtualizacao = skusBipados.map(skuOriginal => {
              const skuLower = skuOriginal.toLowerCase();
              const qtd = contagem[skuOriginal];
              return new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO estoque_quiosque (quiosque, sku, quantidade)
                   VALUES (?, ?, ?)
                   ON CONFLICT(quiosque, sku) DO UPDATE SET quantidade=excluded.quantidade`,
                  [quiosque, skuLower, qtd],
                  err => (err ? reject(err) : resolve())
                );
              });
            });

            Promise.all(promessasAtualizacao)
              .then(() => {
                res.json({ mensagem: `Estoque atualizado com sucesso. Relatório salvo em ${nomeArquivo}` });
              })
              .catch(err => {
                console.error("Erro ao atualizar estoque:", err);
                res.status(500).json({ mensagem: "Erro ao atualizar estoque." });
              });
          });
        }
      );
    }
  );
};


function gerarRelatorioConferencia(quiosque, contador, contagem, estoqueAntes, callback) {
  const data = new Date();
  const timestamp = data.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const nomeArquivo = `conferencia-${quiosque.replace(/\s+/g, '_')}-${timestamp}.txt`;
  const caminho = path.join(__dirname, '../relatorios/conferencia', nomeArquivo);

  // Mapeia estoque antes com SKUs lowercase
  const estoqueMap = {};
  estoqueAntes.forEach(item => {
    estoqueMap[item.sku.toLowerCase()] = item.quantidade;
  });

  // Mapeia contagem para lowercase
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
        if (contado > anterior) {
          obs += ' ▲ Aumentou';
        } else if (contado < anterior) {
          obs += ' ▼ Diminuiu';
        }
      }
    } else if (contagemMap[sku] !== undefined && estoqueMap[sku] === undefined) {
      obs = '➕ Novo SKU';
    } else if (contagemMap[sku] === undefined && estoqueMap[sku] !== undefined) {
      obs = '⏸️ Não bipado';
    }

    conteudo += `${sku.padEnd(30)}${String(contado).padEnd(10)}${String(anterior).padEnd(10)}${obs}\n`;
  }

  fs.writeFile(caminho, conteudo, (err) => {
    if (err) return callback(err);
    callback(null, nomeArquivo);
  });
}