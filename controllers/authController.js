const bcrypt = require('bcrypt');
const pool = require('../models/postgres'); // ajuste o caminho

exports.loginPage = (req, res) => {
  res.render('login');
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
  res.render('registro');
};

exports.registro = async (req, res) => {
  const { username, senha, quiosque } = req.body;

  if (!username || !senha || !quiosque) {
    return res.status(400).json({ status: 'erro', mensagem: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Busca o id do quiosque pelo nome
    const resultQuiosque = await pool.query('SELECT id FROM quiosques WHERE nome = $1', [quiosque]);
    if (resultQuiosque.rows.length === 0) {
      return res.status(400).json({ status: 'erro', mensagem: 'Quiosque não encontrado.' });
    }
    const quiosque_id = resultQuiosque.rows[0].id;

    const hash = await bcrypt.hash(senha, 10);

    const queryText = `
      INSERT INTO usuarios (username, senha, quiosque_id) 
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    await pool.query(queryText, [username, hash, quiosque_id]);

    res.json({ status: 'ok', mensagem: 'Usuário registrado com sucesso!' });
  } catch (err) {
    if (err.code === '23505') { // usuário já existe
      return res.status(400).json({ status: 'erro', mensagem: 'Usuário já existe.' });
    }
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao registrar.' });
  }
};

exports.login = async (req, res) => {
  const { username, senha } = req.body;

  try {
    const queryText = `SELECT * FROM usuarios WHERE username = $1`;
    const result = await pool.query(queryText, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'erro', mensagem: 'Usuário ou senha inválidos' });
    }

    const user = result.rows[0];
    const senhaOk = await bcrypt.compare(senha, user.senha);

    if (!senhaOk) {
      return res.status(401).json({ status: 'erro', mensagem: 'Usuário ou senha inválidos' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      admin: user.admin === 1 || user.admin === true, // dependendo do tipo no banco
      quiosque: user.quiosque_id,
      nivel: user.nivel
    };

    console.log('Valor de user.admin:', user.admin, 'Tipo:', typeof user.admin);

    res.json({ status: 'ok', mensagem: 'Login bem-sucedido' });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao fazer login' });
  }
};

exports.sessionUser = async (req, res) => {
  const userSession = req.session.user;
  if (!userSession) return res.json({});

  const quiosqueId = userSession.quiosque; // esse é o ID (int)

  try {
    const result = await pool.query('SELECT nome FROM quiosques WHERE id = $1', [quiosqueId]);

    const nomeQuiosque = result.rows.length > 0 ? result.rows[0].nome : null;

    res.json({
      username: userSession.username,
      admin: userSession.admin,
      nivel: userSession.nivel,
      quiosque_id: quiosqueId,        // <-- Adiciona aqui o ID
      quiosque: nomeQuiosque          // <-- Nome amigável
    });
  } catch (err) {
    console.error('Erro ao buscar nome do quiosque:', err);
    res.json({
      username: userSession.username,
      admin: userSession.admin,
      nivel: userSession.nivel,
      quiosque_id: quiosqueId,        // <-- Mesmo no erro, ainda retorna
      quiosque: null
    });
  }
};



exports.meuQuiosque = async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  const quiosqueId = req.session.user.quiosque;

  try {
    const result = await pool.query(
      'SELECT nome FROM quiosques WHERE id = $1',
      [quiosqueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Quiosque não encontrado' });
    }

    res.json({
      quiosque: quiosqueId,
      nome: result.rows[0].nome,
      admin: req.session.user.admin,
      id: req.session.user.id,
      nivel: req.session.user.nivel || 'user'
    });
  } catch (err) {
    console.error('Erro ao buscar nome do quiosque:', err.message);
    res.status(500).json({ erro: 'Erro interno ao buscar quiosque' });
  }
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
