const { Router } = require("express");
const app = Router();


const MatchControler = require('../Controller/MatchControler')
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app.use(authMiddleware);

app.get('/', MatchControler.getMatchDetails);
app.get('/participants-availables', MatchControler.getAvailableParticipants);


app.post('/start', MatchControler.startNewMatch);

  app.put('/end-set', MatchControler.addSetToMatch);



module.exports = app;
