    const db = require('../models/db');
    const path = require('path');
    const multer = require('multer');
    const fs = require('fs');

    // Configuração de upload para fotos de SKUs
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

    const upload = multer({ storage: storage });

    exports.uploadMiddleware = upload.single('foto');

    
exports.listarPrecos = (req, res) => {
    console.log('Chamaram o GET /api/precos');

    db.all('SELECT sku, preco, foto FROM precos', (err, rows) => {
        if (err) {
        console.error('Erro ao buscar preços:', err.message);
        return res.status(500).json({ status: 'erro', mensagem: 'Erro no banco de dados.' });
        }

        console.log('SKUs encontrados:', rows); 

        const dadosCompletos = rows.map(row => ({
        ...row,
        foto: row.foto || `/imagens/skus/${row.sku}.jpg`
        }));

        res.json(dadosCompletos);
    });
    };
    exports.atualizarPreco = (req, res) => {
    const { sku } = req.params;
    const preco = Number(req.body.preco);

    if (isNaN(preco) || preco < 0) {
        return res.status(400).json({ status: 'erro', mensagem: 'Preço inválido' });
    }

    const query = `UPDATE precos SET preco = ? WHERE sku = ?`;
    db.run(query, [preco, sku], function (err) {
        if (err) {
        return res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar preço' });
        }

        if (this.changes === 0) {
        return res.status(404).json({ status: 'erro', mensagem: 'SKU não encontrado' });
        }

        res.json({ status: 'ok', mensagem: `Preço do SKU ${sku} atualizado para R$ ${preco.toFixed(2)}` });
    });
    };

    exports.deletarPreco = (req, res) => {
    const { sku } = req.params;

    const query = `DELETE FROM precos WHERE sku = ?`;
    db.run(query, [sku], function (err) {
        if (err) {
        return res.status(500).json({ status: 'erro', mensagem: 'Erro ao remover preço' });
        }

        if (this.changes === 0) {
        return res.status(404).json({ status: 'erro', mensagem: 'SKU não encontrado' });
        }

        res.json({ status: 'ok', mensagem: `Preço do SKU ${sku} removido com sucesso` });
    });
    };

    exports.precosPage = (req, res) => {
      res.render('precos', { userSession: req.session.user });
    };

    exports.adicionarPreco = (req, res) => {
    const { sku } = req.body;
    const preco = Number(req.body.preco);

    if (!sku || isNaN(preco) || preco < 0) {
        return res.status(400).json({ status: 'erro', mensagem: 'SKU ou preço inválidos.' });
    }

    db.run(`
        INSERT INTO precos (sku, preco)
        VALUES (?, ?)
        ON CONFLICT(sku) DO UPDATE SET preco = excluded.preco
    `, [sku, preco], function (err) {
        if (err) {
        console.error('Erro ao inserir/atualizar preço:', err.message);
        return res.status(500).json({ status: 'erro', mensagem: 'Erro no banco de dados.' });
        }

        res.json({ status: 'ok', mensagem: 'Preço cadastrado/atualizado com sucesso.' });
    });
    };

    // Controller para cadastro com foto
    exports.cadastrarSku = (req, res) => {
    const { sku } = req.body;
    const preco = Number(req.body.preco);
    if (!sku || isNaN(preco) || preco < 0) {
        return res.status(400).json({ status: 'erro', mensagem: 'SKU ou preço inválidos.' });
    }

    if (!req.file) {
        return res.status(400).json({ status: 'erro', mensagem: 'Arquivo de foto obrigatório.' });
    }

    // Caminho público relativo para salvar no DB
    const fotoPath = `/imagens/skus/${req.file.filename}`;

    db.run(`INSERT OR REPLACE INTO precos (sku, preco, foto) VALUES (?, ?, ?)`,
        [sku, preco, fotoPath],
        (err) => {
        if (err) {
            console.error('Erro ao inserir SKU:', err.message);
            return res.status(500).json({ status: 'erro', mensagem: 'Erro ao cadastrar SKU.' });
        }
        res.redirect('/cadastrar-sku');
        });
    };


exports.renomearSKU = (req, res) => {
  const user = req.session.user;

  if (!user || user.nivel !== 'deus') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas usuários nível "deus" podem renomear SKUs.' });
  }

  const { skuAntigo, skuNovo } = req.body;

  if (!skuAntigo || !skuNovo) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados inválidos.' });
  }

  db.run(`UPDATE precos SET sku = ? WHERE sku = ?`, [skuNovo, skuAntigo], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ status: 'erro', mensagem: 'Erro ao renomear SKU.' });
    }

    return res.json({ status: 'ok', mensagem: 'SKU renomeado com sucesso.' });
  });
};
