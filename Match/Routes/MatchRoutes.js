const { Router } = require("express");
const app = Router();


const MatchControler = require('../Controller/MatchControler')
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app.use(authMiddleware);

app.get('/', MatchControler.getMatchDetails);

app.get('/finals', async (req, res) => {
  try {
    const matchDetails = await MatchControler.getMatchDetailsForFinals(req.query.matchId);
    res.status(200).json(matchDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/top-4', async (req, res) => {
  try {
    const top4 = await MatchControler.getTop4(req.query.tournamentId);
    res.status(200).json(top4);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/participants-availables', MatchControler.getAvailableParticipants);


app.post('/start', MatchControler.startNewMatch);

app.put('/end-set', MatchControler.addSetToMatch);

app.put('/finals/end-set', MatchControler.addSetToFinalMatch);


app.post('/:id/initialize', async (req, res) => {
  try {
    const tournament = await MatchControler.initializeFinalsBracket(req.params.id);
    res.status(200).json(tournament);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
});

app.put('/:tournamentId/matches/:matchId', async (req, res) => {
  try {
    const tournament = await MatchControler.updateBracketMatch(
      req.params.tournamentId,
      req.params.matchId,
      req.body.winnerId
    );
    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/:id/bracket', async (req, res) => {
  try {
    const bracket = await MatchControler.getBracketStructure(req.params.id);
    res.status(200).json(bracket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
