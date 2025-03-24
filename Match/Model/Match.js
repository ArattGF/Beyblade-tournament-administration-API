const mongoose = require('mongoose');


const setSchema = new mongoose.Schema({
  player1Points: Number,
  player2Points: Number,
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant'
  }
}, { _id: false });

const matchSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant'
    }],
    validate: {
      validator: function(arr) {
        return this.stage !== 'group' || arr.length === 2;

      },
      message: 'Debe tener exactamente 2 participantes'
    }
  },
  sets: [setSchema],
  stage: {
    type: String,
    enum: ['group', 'finals','semifinal', 'final', 'consolation'],
    required: true
  },
  status: {
    type: String,
            
    enum: ['scheduled', 'pending', 'ongoing', 'completed'],
    default: 'scheduled'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant'
  },
  previousMatches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }],
  nextMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }
});

module.exports = mongoose.model('Match', matchSchema); 