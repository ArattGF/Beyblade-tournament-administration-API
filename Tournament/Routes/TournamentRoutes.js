const { Router } = require("express");
const app = Router();

const TournamentController = require('../Controller/TournamentController');
const authMiddleware = require('../../app/middleware/AuthMiddleware');

app.use(authMiddleware);

app.get('/', TournamentController.getCurrentTournament );
 
app.post('/create', TournamentController.createTournament);

app.put('/update/:id', (req, res) => {
    // Logic to update a resource
    res.send(`Resource with id ${req.params.id} updated`);
});

app.delete('/delete/:id', (req, res) => {
    // Logic to delete a resource
    res.send(`Resource with id ${req.params.id} deleted`);
});

module.exports = app;