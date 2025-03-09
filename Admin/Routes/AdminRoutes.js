const { Router } = require('express');

const {signInUser, createUser} = require('../Controller/AdminController');

const app = Router();

// Define your routes here
app.post('/login', signInUser);

module.exports = app;