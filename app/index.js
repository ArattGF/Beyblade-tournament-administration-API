const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const cors = require('cors');
const AuthMiddleware = require('./middleware/AuthMiddleware')

dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:4200', 'https://hidrobladers.vercel.app']
}));
app.use(express.json()); 


app.use('/tournament', require('../Tournament/Routes/TournamentRoutes'))
app.use('/group', require('../Group/Routes/GroupRoutes'))
app.use('/participant', require('../Participant/Routes/ParticipantRoutes'))
app.use('/admin', require('../Admin/Routes/AdminRoutes'))
app.get('/',AuthMiddleware ,(req, res) => res.send('Hello World!'))


mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to mongoDB');
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log('Error connecting to mongoDB:', error);
  });
