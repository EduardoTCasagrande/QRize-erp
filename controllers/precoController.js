const pool = require('../models/postgres');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Configuração do multer para fotos de SKUs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/imagens/skus');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeArquivo = req.body.sku + ext;
    cb(null, nomeArquivo);
  }
});
const upload = multer({ storage });
exports.uploadMiddleware = upload.single('foto');


exports.listarPrecos = async (req, res) => {
  try {
    console.log('Chamaram o GET /api/precos');
    const result = await pool.query('SELECT sku, preco, foto FROM precos');
    console.log('SKUs encontrados:', result.rows);

    const dadosCompletos = result.rows.map(row => ({
      ...row,
      foto: row.foto || `/imagens/skus/${row.sku}.jpg`
    }));

    res.json(dadosCompletos);
  } catch (err) {
    console.error('Erro ao buscar preços:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro no banco de dados.' });
  }
};

exports.atualizarPreco = async (req, res) => {
  const { sku } = req.params;
  const preco = Number(req.body.preco);

  if (isNaN(preco) || preco < 0) {
    return res.status(400).json({ status: 'erro', mensagem: 'Preço inválido' });
  }

  try {
    const result = await pool.query(
      'UPDATE precos SET preco = $1 WHERE sku = $2',
      [preco, sku]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'erro', mensagem: 'SKU não encontrado' });
    }

    res.json({ status: 'ok', mensagem: `Preço do SKU ${sku} atualizado para R$ ${preco.toFixed(2)}` });
  } catch (err) {
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar preço' });
  }
};

exports.deletarPreco = async (req, res) => {
  const { sku } = req.params;

  try {
    const result = await pool.query('DELETE FROM precos WHERE sku = $1', [sku]);

    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'erro', mensagem: 'SKU não encontrado' });
    }

    res.json({ status: 'ok', mensagem: `Preço do SKU ${sku} removido com sucesso` });
  } catch (err) {
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao remover preço' });
  }
};

exports.precosPage = (req, res) => {
  res.render('precos', { userSession: req.session.user });
};

exports.adicionarPreco = async (req, res) => {
  const { sku } = req.body;
  const preco = Number(req.body.preco);

  if (!sku || isNaN(preco) || preco < 0) {
    return res.status(400).json({ status: 'erro', mensagem: 'SKU ou preço inválidos.' });
  }

  try {
    await pool.query(
      `INSERT INTO precos (sku, preco)
       VALUES ($1, $2)
       ON CONFLICT (sku) DO UPDATE SET preco = EXCLUDED.preco`,
      [sku, preco]
    );
    res.json({ status: 'ok', mensagem: 'Preço cadastrado/atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao inserir/atualizar preço:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro no banco de dados.' });
  }
};

// Controller para cadastro com foto
exports.cadastrarSku = async (req, res) => {
  const { sku } = req.body;
  const preco = Number(req.body.preco);

  if (!sku || isNaN(preco) || preco < 0) {
    return res.status(400).json({ status: 'erro', mensagem: 'SKU ou preço inválidos.' });
  }

  if (!req.file) {
    return res.status(400).json({ status: 'erro', mensagem: 'Arquivo de foto obrigatório.' });
  }

  const fotoPath = `/imagens/skus/${req.file.filename}`;

  try {
    await pool.query(
      `INSERT INTO precos (sku, preco, foto)
       VALUES ($1, $2, $3)
       ON CONFLICT (sku) DO UPDATE SET preco = EXCLUDED.preco, foto = EXCLUDED.foto`,
      [sku, preco, fotoPath]
    );
    res.redirect('/cadastrar-sku');
  } catch (err) {
    console.error('Erro ao inserir SKU:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao cadastrar SKU.' });
  }
};

exports.renomearSKU = async (req, res) => {
  const user = req.session.user;

  if (!user || user.nivel !== 'deus') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas usuários nível "deus" podem renomear SKUs.' });
  }

  const { skuAntigo, skuNovo } = req.body;

  if (!skuAntigo || !skuNovo) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados inválidos.' });
  }

  try {
    await pool.query(
      `UPDATE precos SET sku = $1 WHERE sku = $2`,
      [skuNovo, skuAntigo]
    );
    res.json({ status: 'ok', mensagem: 'SKU renomeado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao renomear SKU.' });
  }
};
