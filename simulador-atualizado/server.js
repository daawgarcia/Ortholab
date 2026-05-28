import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import simularRoute from './routes/simular.js';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/simular-upload-controlnet', upload.any(), simularRoute);

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
