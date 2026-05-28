import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';

export default async function (req, res) {
  const resultados = [];

  for (const file of req.files) {
    const formData = new FormData();
    formData.append('version', 'YOUR_REPLICATE_MODEL_VERSION');
    formData.append('input', JSON.stringify({
      image: fs.createReadStream(file.path),
      prompt: "simule o resultado ortodôntico (dentes mais alinhados, rotação corrigida)",
      guidance_scale: 9,
      num_inference_steps: 30
    }));

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
      },
      body: formData
    });

    const result = await response.json();
    resultados.push(result?.output?.[0] || '');
  }

  res.json({ resultados });
}
