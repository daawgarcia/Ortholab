const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/simular-controlnet', upload.any(), async (req, res) => {
  try {
    const imagens = req.files || [];
    if (imagens.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma imagem recebida.' });
    }

    const resultados = [];
    for (const imagem of imagens) {
      const imageBuffer = fs.readFileSync(imagem.path);
      const base64Image = imageBuffer.toString('base64');

      const response = await axios.post(
        'https://api.replicate.com/v1/predictions',
        {
          version: "d2cfb22e8dcaf7aa1f06c3e9b61183c4239647c3e39f841e1d1b529cbd315363",
          input: {
            image: `data:image/jpeg;base64,${base64Image}`,
            prompt: "sorriso com dentes alinhados, corrigidos com alinhadores estéticos, resultado ortodôntico natural e realista",
            a_prompt: "dentes realistas, sorriso natural, textura dental, simulação precisa",
            n_prompt: "boca deformada, dentes tortos, arte digital, ilustração",
            mode: "canny"
          }
        },
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const resultado = response.data?.urls?.get;
      if (resultado) resultados.push(resultado);

      fs.unlinkSync(imagem.path);
    }

    res.json({ resultados });
  } catch (error) {
    console.error('Erro na simulação com ControlNet:', error.response?.data || error.message);
    res.status(500).json({ erro: 'Erro ao processar a simulação com ControlNet.' });
  }
});

module.exports = router;
