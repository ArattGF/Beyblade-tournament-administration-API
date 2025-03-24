const { Router } = require("express");
const app = Router();

const GroupController = require('../Controller/GroupController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');


app.get('/', GroupController.getAllGroups );

// app.get('/', GroupController.getAllGroups );

app.post('/create', authMiddleware,GroupController.createGroup);


module.exports = app;
