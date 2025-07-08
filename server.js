const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors({
  origin: 'https://hengtong-ajj7fkmfb-kais-projects-975b317e.vercel.app',
  credentials: true
}));
