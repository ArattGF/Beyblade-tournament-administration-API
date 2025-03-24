const mongoose = require('mongoose');
const Group = require('../../Group/Model/Group')

const tournamentSchema = new mongoose.Schema({
  name: { 
    type: String,
    required: true
  },
  numberOfGroups: {
    type: Number,
    required: true
  },
  maxParticipantsPerGroup: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['created', 'registration', 'group', 'finals', 'semifinal', 'final', 'completed'],
    default: 'created'
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  finalsBracket:  {
    rounds: [{
      roundNumber: Number,
      matches: [{
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
        participants: [{ 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Participant' 
        }],
        bye: { // Indica si un participante avanza sin jugar
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Participant'
        },
        winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant' },
        status: { 
          type: String, 
          enum: [ 'scheduled','pending', 'ongoing', 'completed'] 
        }
      }]
    }]
  }
});

module.exports = mongoose.model('Tournament', tournamentSchema);