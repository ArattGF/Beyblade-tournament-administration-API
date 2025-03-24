const { Router } = require("express");
const app = Router();

const TournamentController = require('../Controller/TournamentController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app.use(authMiddleware);

app.get('/', TournamentController.getCurrentTournament );
 
app.post('/create', TournamentController.createTournament);

app.post('/start', TournamentController.changePhase);


module.exports = app;