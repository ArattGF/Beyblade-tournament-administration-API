const { Router } = require('express');


const bcrypt = require('bcryptjs');

const {signInUser, createUser} = require('../Controller/AdminController');

const app = Router();

// Define your routes here
app.post('/login', signInUser);

// Nueva ruta para encriptar texto
app.get('/encrypt', async (req, res) => {
  const { text } = req.query;

  if (!text) {
      return res.status(400).json({ error: 'El parámetro "text" es requerido.' });
  }

  try {
      const saltRounds = 10; // Número de rondas de encriptación
      const hashedText = await bcrypt.hash(text, saltRounds);
      res.json({ original: text, encrypted: hashedText });
  } catch (error) {
      console.error('Error al encriptar el texto:', error);
      res.status(500).json({ error: 'Error al encriptar el texto.' });
  }
});

module.exports = app;