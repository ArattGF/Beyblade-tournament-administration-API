const { Router } = require("express");

const ParticipantController = require('../Controller/ParticipantController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app = Router();



app.get('/winners', ParticipantController.getGroupWinners);

app.get('/',authMiddleware, ParticipantController.getAllParticipants);

app.post('/create',authMiddleware, ParticipantController.createParticipant);

module.exports = app; 
