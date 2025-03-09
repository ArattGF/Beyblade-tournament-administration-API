const { Router } = require("express");
const app = Router();

const GroupController = require('../Controller/GroupController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app.use(authMiddleware);

app.get('/', GroupController.getAllGroups );

app.post('/create', GroupController.createGroup);


module.exports = app;
