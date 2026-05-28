const express = require('express');
const multer = require('multer');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/simular-upload-controlnet', upload.any(), async (req, res) => {
  try {
    const imagensRecebidas = req.files;

    if (!imagensRecebidas || imagensRecebidas.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma imagem recebida.' });
    }

    const resultados = imagensRecebidas.map((file, index) =>
      `https://fake.url/resultados/imagem${index + 1}.png`
    );

    return res.json({ resultados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao processar as imagens.' });
  }
});

module.exports = router;
