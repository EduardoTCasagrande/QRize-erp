// controllers/skuController.js
const pool = require('../models/postgres');
const QRCode = require('qrcode');

exports.listarSkusComQr = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT sku, preco, foto FROM precos ORDER BY sku');

    const skusComQr = await Promise.all(
      rows.map(async (item) => {
        const qrDataUrl = await QRCode.toDataURL(item.sku); 
        return {
          sku: item.sku,
          preco: item.preco,
          foto: item.foto,
          qrCode: qrDataUrl
        };
      })
    );

    res.json(skusComQr);
  } catch (err) {
    console.error('Erro ao listar SKUs com QR:', err);
    res.status(500).json({ erro: 'Erro ao listar SKUs.' });
  }
};

exports.page = (req, res) =>{
    res.render('qrcodes')
}