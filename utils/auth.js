// utils/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateAuthToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

module.exports = { generateAuthToken };