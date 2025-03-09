const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  victories: {
    type: Number,
    default: 0 
  },
  groupPoints: {
    type: Number,
    default: 0
  },
  elimPoints: {
    type: Number,
    default: 0
  },
  totalSets: {
    type: Number,
    default: 0
  },
  position: Number
});

// Virtuals para cálculos dinámicos
participantSchema.virtual('totalPoints').get(function() {
  return this.groupPoints + this.elimPoints;
});

participantSchema.index({name: 1}, {unique: true});

module.exports = mongoose.model('Participant', participantSchema);