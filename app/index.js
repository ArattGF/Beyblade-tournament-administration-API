const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config();

const app = express();
app.use(express.json()); 



app.use('/tournament', require('../Tournament/Routes/TournamentRoutes'))
app.use('/admin', require('../Admin/Routes/AdminRoutes'))
app.get('/', (req, res) => res.send('Hello World!'))


mongoose.connect(process.env.MONGODB_URI).then  (() => {
console.log('Connected to mongoDB')

  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

}).catch((error) => {
  console.log('Error connecting to mongoDB:', error);
})