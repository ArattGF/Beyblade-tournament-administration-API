const { Router } = require("express");

const ParticipantController = require('../Controller/ParticipantController');

 app = Router();


 app.get('/', ParticipantController.getAllParticipants);
 
 app.post('/create', ParticipantController.createParticipant);

module.exports = app; 
