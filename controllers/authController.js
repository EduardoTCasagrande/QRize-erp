const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../models/db');

exports.loginPage = (req, res) => {
  res.render('login')
};

exports.dashboard = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.render('dashboard', {
    user: req.session.user
  });
};


exports.registroPage = (req, res) => {
  res.render('registro')
};

exports.registro = async (req, res) => {
  const { username, senha, quiosque } = req.body;

  if (!username || !senha || !quiosque) {
    return res.status(400).json({ status: 'erro', mensagem: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);

    db.run(`INSERT INTO usuarios (username, senha, quiosque) VALUES (?, ?, ?)`,
      [username, hash, quiosque],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ status: 'erro', mensagem: 'Usuário já existe.' });
          }
          console.error("Erro ao registrar usuário:", err.message);
          return res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao registrar.' });
        }
        res.json({ status: 'ok', mensagem: 'Usuário registrado com sucesso!' });
      });

  } catch (err) {
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao processar senha.' });
  }
};

exports.login = (req, res) => {
  const { username, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao buscar usuário' });

    if (!user) return res.status(401).json({ status: 'erro', mensagem: 'Usuário ou senha inválidos' });

    const senhaOk = await bcrypt.compare(senha, user.senha);
    if (!senhaOk) {
      return res.status(401).json({ status: 'erro', mensagem: 'Usuário ou senha inválidos' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      admin: user.admin === 1,
      quiosque: user.quiosque,
      nivel: user.nivel
    };

    console.log('Valor de user.admin:', user.admin, 'Tipo:', typeof user.admin);


    res.json({ status: 'ok', mensagem: 'Login bem-sucedido' });
  });
};

exports.sessionUser = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ erro: 'Sessão expirada' });
  }
  res.json({
    quiosque: req.session.user.quiosque,
    username: req.session.user.username,
    admin: req.session.user.admin,
    nivel: req.session.user.nivel
  });
};


exports.meuQuiosque = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  res.json({ quiosque: req.session.user.quiosque });
};

exports.sessionInfo = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ logado: false });
  }

  res.json({
    logado: true,
    admin: req.session.user.admin,
    quiosque: req.session.user.quiosque
  });
};


exports.getUsuarioLogado = (req, res) => {
  const usuario = req.session.user || {};
  const quiosque = usuario.quiosque || null;

  res.json({
    quiosque: quiosque,
    admin: usuario.admin === true,  
    nome: usuario.username || null, 
    id: usuario.id || null
  });
};
