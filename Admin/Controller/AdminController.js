
const Admin = require('../Model/Admin');
const bcrypt = require('bcryptjs');
const { generateAuthToken } = require('../utils/jwt');


exports.signInUser = async (req, res) => {
  try {

    const { user, passwd } = req.body;

    // Validación básica
    if (!user || !passwd) {
      
      return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
    }


    const users = await Admin.findOne({user});

    if (!users) {
      return res.status(401).send('Invalid credentials');
    } 
     
    let isMatch = await bcrypt.compare(passwd, users.password);

    if (!isMatch) {
      return res.status(401).send('Invalid credentials');
      
    }
    // Eliminar el campo password de cada usuario

    const userWithoutPassword = users.toObject();
    delete userWithoutPassword.password;

    // Generar token de autenticación (opcional, usando JWT)
    const token = generateAuthToken(users._id); // Generar token de autenticación

    res.status(200).json({ ok: true, message: "Inicio de sesión exitoso", user: userWithoutPassword, token });

  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
};

