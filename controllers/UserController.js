
const User = require('../conf/database/models/User');
const bcrypt = require('bcryptjs');

const { generateAuthToken } = require('../utils/auth'); // Importar el helper

exports.getAllUsers = async (req, res) => {
  try {

    const { user, password } = req.body;
    // Validación básica
    if (!user || !password) {
      return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
    }


    const users = await User.find();

    if (!users) {
      return res.status(401).send('Invalid credentials');
    }

    // Eliminar la contraseña de la respuesta
    const userData = foundUser.toObject();
    delete userData.password;

    // Generar token de autenticación (opcional, usando JWT)
    const token = generateAuthToken(foundUser._id); // Implementa esta función

    res.status(200).json({ message: "Inicio de sesión exitoso", user: userData, token });

  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
};

