const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  max:{
    type: Number
  },
  name: {
    type: String,
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant'
  }],
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }]
});

module.exports = mongoose.model('Group', groupSchema);