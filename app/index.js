const express = require('express')
const cors = require('cors');

const dotenv = require('dotenv')

const mongoose = require('mongoose')
const http = require('http');

const { Server } = require('socket.io');

const AuthMiddleware = require('./middleware/AuthMiddleware')

const SocketManager = require('./socket/SocketManager') 


dotenv.config();
const env = process.env;

const app = express();
const server = http.createServer(app);

const PORT = env.PORT || 3001;

// Servidor para socket.IO
const io = SocketManager.getInstance(server);


app.use((req, res, next) => {
  req.io = io; 
  next();
});

// Cors para llamadas a la API
app.use(cors(
  {
    origin: '*'
    // origin: [ env.FRONT_URL_DEBUG,env.FRONT_URL_RELEASE]
  }

));
app.use(express.json()); 


app.use('/tournament', require('../Tournament/Routes/TournamentRoutes'))
app.use('/group', require('../Group/Routes/GroupRoutes'))
app.use('/participant', require('../Participant/Routes/ParticipantRoutes'))
app.use('/match', require('../Match/Routes/MatchRoutes'))
app.use('/admin', require('../Admin/Routes/AdminRoutes'))
app.get('/',AuthMiddleware ,(req, res) => res.send({message: 'Hello World!', ok: true}))


mongoose.connect(env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to mongoDB');
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log('Error connecting to mongoDB:', error);
  });
