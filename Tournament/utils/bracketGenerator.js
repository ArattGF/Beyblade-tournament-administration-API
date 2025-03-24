
const Match = require('../../Match/models/Match');
const Participant = require('../../Participant/models/Participant');

const generateBracketStructure = (participants) => {
  const participantCount = participants.length;
  const rounds = Math.ceil(Math.log2(participantCount));
  const matches = [];
  
  // Crear match final
  const finalMatch = {
    roundNumber: rounds,
    matches: [{
      participants: [],
      status: 'pending',
      matchId: null
    }]
  };
  matches.push(finalMatch);

  // Crear rondas anteriores
  for (let round = rounds - 1; round >= 1; round--) {
    const matchesInRound = Math.pow(2, rounds - round);
    const roundMatches = [];
    
    for (let i = 0; i < matchesInRound; i++) {
      roundMatches.push({
        participants: [],
        status: 'pending',
        matchId: null
      });
    }
    
    matches.unshift({
      roundNumber: round,
      matches: roundMatches
    });
  }

  return matches;
};

const seedParticipants = (participants, bracketRounds) => {
  const firstRound = bracketRounds[0];
  const sortedParticipants = [...participants].sort((a, b) => (a.seed || 99) - (b.seed || 99));
  
  const participantCount = sortedParticipants.length;
  const byeCount = firstRound.matches.length * 2 - participantCount;
  let participantIndex = 0;

  firstRound.matches.forEach((match, index) => {
    if (index < byeCount) {
      match.participants.push(sortedParticipants[participantIndex++]);
      match.participants.push(createByeParticipant(index));
      match.bye = sortedParticipants[participantIndex - 1]._id;
    } else {
      match.participants.push(sortedParticipants[participantIndex++]);
      match.participants.push(sortedParticipants[participantIndex++]);
    }
  });

  return bracketRounds;
};

const createByeParticipant = (index) => ({
  _id: `BYE-${index}-${Date.now()}`,
  name: "BYE",
  isBye: true
});

const advanceWinner = (currentMatch, bracketRounds) => {
  const nextRoundIndex = currentMatch.roundNumber;
  const nextMatchIndex = Math.floor(currentMatch.matchIndex / 2);
  
  const nextRound = bracketRounds.find(r => r.roundNumber === nextRoundIndex + 1);
  if (!nextRound) return;

  const nextMatch = nextRound.matches[nextMatchIndex];
  if (!nextMatch.participants[0]) {
    nextMatch.participants[0] = currentMatch.winner;
  } else {
    nextMatch.participants[1] = currentMatch.winner;
  }
};

module.exports = {
  initializeTournamentBracket: async (tournamentId, participants) => {
    try {
      const bracketRounds = generateBracketStructure(participants);
      const seededBracket = seedParticipants(participants, bracketRounds);
      
      // Crear matches en la base de datos
      for (const round of seededBracket) {
        for (const match of round.matches) {
          const newMatch = new Match({
            tournament: tournamentId,
            stage: 'final',
            participants: match.participants.filter(p => !p.isBye).map(p => p._id),
            status: match.status,
            bye: match.bye
          });
          
          await newMatch.save();
          match.matchId = newMatch._id;
        }
      }
      
      // Añadir tercer lugar
      const thirdPlaceMatch = new Match({
        tournament: tournamentId,
        stage: 'consolation',
        status: 'pending'
      });
      await thirdPlaceMatch.save();
      
      seededBracket.push({
        roundNumber: seededBracket.length + 1,
        matches: [{
          matchId: thirdPlaceMatch._id,
          participants: [],
          status: 'pending',
          isThirdPlace: true
        }]
      });

      return seededBracket;
    } catch (error) {
      throw error;
    }
  },

  updateBracket: async (tournament, matchId, winnerId) => {
    try {
      // Encontrar el match actualizado
      const currentMatch = tournament.finalsBracket.rounds
        .flatMap(r => r.matches)
        .find(m => m.matchId.equals(matchId));
      
      // Actualizar ganador
      currentMatch.winner = winnerId;
      currentMatch.status = 'completed';
      
      // Avanzar ganador al siguiente match
      advanceWinner(currentMatch, tournament.finalsBracket.rounds);
      
      // Manejar tercer lugar para semifinales
      if (currentMatch.roundNumber === tournament.finalsBracket.rounds.length - 2) {
        const loser = currentMatch.participants.find(p => !p.equals(winnerId));
        const thirdPlaceMatch = tournament.finalsBracket.rounds
          .flatMap(r => r.matches)
          .find(m => m.isThirdPlace);
        
        if (!thirdPlaceMatch.participants[0]) {
          thirdPlaceMatch.participants[0] = loser;
        } else {
          thirdPlaceMatch.participants[1] = loser;
        }
      }
      
      await tournament.save();
      return tournament;
    } catch (error) {
      throw error;
    }
  }
};