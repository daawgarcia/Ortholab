const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const controlnetRoute = require('./routes/controlnet');
app.use('/', controlnetRoute);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
