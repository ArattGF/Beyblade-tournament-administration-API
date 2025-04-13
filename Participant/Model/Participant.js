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
  seed: {
    type: Number,
    default: 0
  },
  isBye: {  // Nuevo campo para identificar BYEs
    type: Boolean,
    default: false
  },
  position: Number,
});

// Índice parcial para unique name solo cuando no es BYE

participantSchema.index(
  { tournament: 1, name: 1 }, // Considera la combinación torneo + nombre
  {
    unique: true,
    partialFilterExpression: { isBye: false  }
  }
);
// Virtuals para cálculos dinámicos
participantSchema.virtual('totalPoints').get(function() {
  return this.groupPoints + this.elimPoints;
});
module.exports = mongoose.model('Participant', participantSchema);