const express = require('express');
const multer = require('multer');
const Replicate = require('replicate');
const router = express.Router();

const upload = multer();
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

router.post('/simular-upload-controlnet', upload.any(), async (req, res) => {
  try {
    const resultados = [];

    for (const file of req.files) {
      const base64Image = file.buffer.toString('base64');
      const imageDataUri = `data:image/png;base64,${base64Image}`;

      const output = await replicate.run(
        "lllyasviel/controlnet", // substitua pelo ID correto se for customizado
        {
          input: {
            image: imageDataUri,
            conditioning_image: imageDataUri,
            prompt: "simule o resultado ortodôntico (dentes mais alinhados, rotação corrigida)",
            a_prompt: "dentes realistas, nitidez, iluminação natural",
            n_prompt: "imagem distorcida, sorriso exagerado, dentes duplicados",
            num_inference_steps: 30,
            strength: 1,
            guess_mode: false
          }
        }
      );

      resultados.push(output[0]);
    }

    res.json({ resultados });
  } catch (error) {
    console.error('Erro ao processar imagens:', error);
    res.status(500).json({ error: 'Erro interno ao gerar imagens' });
  }
});

module.exports = router;