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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Origin', 'https://hidrobladers.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

app.use('/tournament', require('../Tournament/Routes/TournamentRoutes'))
app.use('/admin', require('../Admin/Routes/AdminRoutes'))
app.get('/',AuthMiddleware ,(req, res) => res.send('Hello World!'))


mongoose.connect(process.env.MONGODB_URI).then  (() => {
console.log('Connected to mongoDB')

  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

}).catch((error) => {
  console.log('Error connecting to mongoDB:', error);
})
