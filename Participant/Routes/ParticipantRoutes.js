const { Router } = require("express");

const ParticipantController = require('../Controller/ParticipantController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app = Router();


app.use(authMiddleware);


app.get('/', ParticipantController.getAllParticipants);
app.get('/winners', ParticipantController.getGroupWinners);

app.post('/create', ParticipantController.createParticipant);

module.exports = app; 
