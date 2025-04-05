const mongoose = require('mongoose')

const Match = require('../Model/Match');
const Group = require('../../Group/Model/Group');
const Participant = require('../../Participant/Model/Participant');
const Tournament = require('../../Tournament/Model/Tournament')

const SocketManager = require('../../app/socket/SocketManager');

Socket = SocketManager.getInstance();

const GetAvailableParticipants = async (req, res) => {
  try {
    const { groupId, participantId } = req.query;


    // Validar ObjectIds
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      return res.status(400).json({ message: 'ID de participante inválido' });
    }



    // Obtener el grupo
    const group = await Group.findById(groupId).select('participants');
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Verificar pertenencia al grupo
    const participantObjectId = new mongoose.Types.ObjectId(participantId);
    if (!group.participants.some(p => p.equals(participantObjectId))) {
      return res.status(404).json({ message: 'Participante no encontrado en el grupo' });
    }

    // Obtener partidos existentes
    const existingMatches = await Match.find({
      group: groupId,
      stage: 'group',
      participants: participantObjectId
    }).select('participants');

    // Procesar oponentes
    const opponents = existingMatches
      .flatMap(m => m.participants)
      .filter(id => !id.equals(participantObjectId))
      .map(id => id.toString());

    const uniqueOpponents = [...new Set(opponents)];

    // Buscar participantes disponibles
    const availableParticipants = await Participant.find({
      _id: {
        $in: group.participants,
        $nin: [
          participantObjectId,
          ...uniqueOpponents.map(id => new mongoose.Types.ObjectId(id))
        ]
      }
    }).select('name region victories totalPoints');

    res.status(200).json({
      count: availableParticipants.length,
      participants: availableParticipants
    });

  } catch (error) {
    console.error('Error en GetAvailableParticipants:', error);
    res.status(500).json({
      message: 'Error del servidor',
      error: error.message
    });
  }
}


const StartNewMatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { groupId } = req.query;
    const { participants } = req.body;



    // Validaciones básicas
    if (!Array.isArray(participants) || participants.length !== 2) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Debe proporcionar exactamente 2 participantes' });
    }

    const [participant1Id, participant2Id] = participants.map(id => new mongoose.Types.ObjectId(id));
    const groupObjectId = new mongoose.Types.ObjectId(groupId);



    // Obtener y validar grupo
    const group = await Group.findById(groupObjectId)
      .populate('tournament', 'name')
      .populate('participants', 'name')
      .session(session);

    if (!group) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Validar participantes
    const participantsInGroup = await Participant.find({
      _id: { $in: [participant1Id, participant2Id] },
      group: groupObjectId
    }).session(session);

    if (participantsInGroup.length !== 2) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Uno o ambos participantes no pertenecen al grupo',
        groupInfo: {
          name: group.name,
          participants: group.participants
        }
      });
    }

    // Crear y guardar nuevo match
    const newMatch = new Match({
      tournament: group.tournament,
      group: groupObjectId,
      participants: [participant1Id, participant2Id],
      stage: 'group',
      status: 'ongoing',
      sets: []
    });

    await newMatch.save({ session });

    // Actualizar grupo con nuevo match
    group.matches.push(newMatch._id);
    await group.save({ session });
    await session.commitTransaction();



    res.status(201).json({
      message: 'Match creado exitosamente',
      match: newMatch._id
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error en createMatch:', error);
    res.status(500).json({
      message: 'Error del servidor',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

const GetMatchDetails = async (req, res) => {
  try {
    const { matchId } = req.query;



    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ message: 'ID de match inválido' });
    }


    const match = await Match.findById(matchId)
      .populate({
        path: 'participants',
        select: 'name region victories groupPoints elimPoints',
      })
      .populate({
        path: 'group',
        select: 'name tournament max participants matches',
        populate: {
          path: 'tournament',
          select: 'name'
        }
      })
      .lean();

    if (!match) {
      return res.status(404).json({ message: 'Match no encontrado' });
    }

    // Calcular puntos totales
    const participantsWithTotals = match.participants.map(p => ({
      ...p,
      totalPoints: p.groupPoints + p.elimPoints
    }));

    // Formatear respuesta del grupo
    const groupResponse = {
      _id: match.group._id,
      name: match.group.name,
      tournament: match.group.tournament,
      maxParticipants: match.group.max,
      currentParticipants: match.group.participants.length,
      totalMatches: match.group.matches.length
    };

    res.status(200).json({
      match: {
        ...match,
        participants: participantsWithTotals
      },
      group: groupResponse
    });

  } catch (error) {
    console.error('Error en getMatchDetails:', error);
    res.status(500).json({
      message: 'Error del servidor',
      error: error.message
    });
  }
};



AddSetToMatch = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionStarted = false; // Bandera de control

  try {
    // Iniciar transacción
    await session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      maxTimeMS: 5000
    });
    transactionStarted = true; // Marcar transacción como iniciada

    const { matchId } = req.query;
    const { participant1Points, participant2Points } = req.body;

    // Validaciones
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      throw new Error('ID de match inválido');
    }


    // Obtener match dentro de la transacción
    const match = await Match.findById(matchId)
      .populate('participants')
      .session(session);

    if (!match) throw new Error('Match no encontrado');
    if (match.status !== 'ongoing' ^ match.status !== 'scheduled' ^ match.status !== 'pending') throw new Error('Match no está en curso');

    // Lógica de sets
    const [p1, p2] = match.participants;
    const newSet = {
      player1Points: participant1Points,
      player2Points: participant2Points,
      winner: participant1Points > participant2Points ? p1._id : p2._id
    };

    match.sets.push(newSet);


    await Participant.updateOne(
      { _id: p1._id },
      { $inc: { groupPoints: participant1Points } },
      { session }
    );

    await Participant.updateOne(
      { _id: p2._id },
      { $inc: { groupPoints: participant2Points } },
      { session }
    );

    // Incrementar totalSets del ganador del set
    await Participant.updateOne(
      { _id: newSet.winner },
      { $inc: { totalSets: 1 } },
      { session }
    );

    // Verificar victoria del partido 
    const victoryCount = match.sets.reduce((acc, set) => {
      acc[set.winner.toString()] = (acc[set.winner.toString()] || 0) + 1;
      return acc;
    }, {})
    const matchWinner = Object.entries(victoryCount).find(([, wins]) => wins >= 2)?.[0];

    if (matchWinner) {
      match.status = 'completed';
      match.winner = matchWinner;
      await Participant.findByIdAndUpdate(matchWinner, { $inc: { victories: 1 } }, { session });
    }




    // Guardar cambios y commit
    await match.save({ session });
    await session.commitTransaction();


    transactionStarted = false; // Marcar transacción como finalizada


    const fullGroup = await Group.findById(match.group)
      .populate({
        path: 'participants',
        select: 'name groupPoints totalSets victories', // Campos que necesitas
        options: { sort: { victories: -1, totalSets: -1, groupPoints: -1 } } // Ordenar por puntuación
      })
      .lean();

    // Estructurar los datos para el socket
    const groupUpdateData = {
      _id: fullGroup._id,
      name: fullGroup.name,
      tournament: fullGroup.tournament,
      participants: fullGroup.participants.map(participant => ({
        _id: participant._id,
        name: participant.name,
        groupPoints: participant.groupPoints,
        totalSets: participant.totalSets,
        victories: participant.victories,
        position: participant.position
      })),
      currentMatch: {
        _id: match._id,
        sets: match.sets,
        status: match.status,
        winner: match.winner
      }
    };

    try {

      Socket.io.emit('update-set', groupUpdateData);
    } catch (err) {
      console.log(err);

    }

    // Preparar respuesta FUERA de la transacción
    const response = {
      currentSet: match.sets.length,
      addedSet: newSet,
      matchStatus: match.status,
      winner: matchWinner ? {
        _id: matchWinner,
        name: matchWinner === p1._id.toString() ? p1.name : p2.name
      } : null,
      nextAction: matchWinner ? 'Match finalizado' : `Continuar al set ${match.sets.length + 1}`
    };

    res.status(200).json(response);

  } catch (error) {
    // Abortar solo si la transacción estaba activa
    if (transactionStarted) {
      await session.abortTransaction();
    }

    console.error('Error en AddSetToMatch:', error);
    res.status(error instanceof mongoose.Error.ValidationError ? 400 : 500).json({
      message: 'Error en la operación',
      error: error.message
    });
  } finally {
    // Finalizar sesión siempre
    if (session) {
      session.endSession();
    }
  }
};


const GetMatchDetailsForFinals = async (matchId) => {
  try {

    console.log(matchId);

    // Obtener el partido específico
    const match = await Match.findById(matchId)
      .populate({
        path: 'participants winner',
        select: '-__v'
      });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    // Función para formatear participantes
    const formatParticipant = (participant) => {
      if (!participant) return undefined;

      return participant.isBye ? {
        _id: `BYE-${participant._id}`,
        name: 'BYE',
        isBye: true
      } : {
        _id: participant._id,
        name: participant.name,
        region: participant.region,
        seed: participant.seed
      };
    };

    // Formatear respuesta
    return {
      id: match._id,
      round: getRoundNumber(match.stage),
      tournamentId: match.tournament,
      participant1: formatParticipant(match.participants[0]),
      participant2: formatParticipant(match.participants[1]),
      status: match.status,
      ...(match.nextMatchId && { nextMatchId: match.nextMatchId }),
      ...(match.winner && { winner: match.winner._id })
    };

  } catch (error) {
    throw new Error(`Error obteniendo detalles del partido: ${error.message}`);
  }
};



//#region Finals

const InitializeFinalsBracket = async (tournamentId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Actualizar estado del torneo
    const tournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      { status: 'finals' },
      { new: true, session }
    );

    // 2. Obtener y ordenar ganadores de grupos
    const groups = await Group.find({ tournament: tournamentId })
      .populate({
        path: 'participants',
        options: { sort: { seed: 1 } }
      })
      .session(session);

    const sortedWinners = groups
      .map(group => group.participants[0])
      .sort((a, b) => a.seed - b.seed);

    // 3. Calcular y asignar BYEs
    const totalParticipants = sortedWinners.length;
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(totalParticipants)));
    const byesNeeded = nextPowerOfTwo - totalParticipants;

    const participantsWithByes = sortedWinners.map((winner, index) => ({
      participant: winner,
      hasBye: index < byesNeeded
    }));


    // 7. Función de avance para BYEs
    const advanceByeWinner = async (byeMatch, winner, session) => {
      const nextRoundNumber = getRoundNumber(byeMatch.stage) + 1;
      const nextStage = getStageFromRound(nextRoundNumber);

      let nextMatch = await Match.findOne({
        tournament: tournamentId,
        stage: nextStage,
        'participants.1': { $exists: false }
      }).session(session);

      if (!nextMatch) {
        nextMatch = new Match({
          tournament: tournamentId,
          stage: nextStage,
          status: 'pending',
          participants: [winner._id],
          previousMatches: [byeMatch._id]
        });
        await nextMatch.save({ session });
      } else {
        nextMatch.participants.push(winner._id);
        await nextMatch.save({ session });
      }

      byeMatch.nextMatchId = nextMatch._id;
      await byeMatch.save({ session });
    };


    // 4. Generar primera ronda con manejo de BYEs
    const firstRoundMatches = [];

    for (let i = 0; i < participantsWithByes.length; i++) {
      const { participant, hasBye } = participantsWithByes[i];

      if (hasBye) {
        const bye = new Participant({
          name: `BYE-${participant.seed}`,
          region: 'SYSTEM',
          isBye: true,
          tournament: tournamentId
        });
        await bye.save({ session });

        const byeMatch = new Match({
          tournament: tournamentId,
          stage: 'finals',
          participants: [participant, bye],
          status: 'completed',
          winner: participant._id,
          nextMatchId: null
        });
        await byeMatch.save({ session });
        firstRoundMatches.push(byeMatch);

        // Avance automático del ganador del BYE
        await advanceByeWinner(byeMatch, participant, session);
      } else {
        if (i < participantsWithByes.length - 1) {
          const opponent = participantsWithByes[participantsWithByes.length - 1 - (i - byesNeeded)];
          const match = new Match({
            tournament: tournamentId,
            stage: 'finals',
            participants: [participant, opponent.participant],
            status: 'scheduled',
            nextMatchId: null
          });
          await match.save({ session });
          firstRoundMatches.push(match);
          i++;
        }
      }
    }

    // 5. Función mejorada para generar rondas siguientes
    // Modificar la función generateNextRounds
    const generateNextRounds = async (matches, roundNumber = 2) => {
      const nextMatches = [];

      // Nueva función para encontrar match existente mejorado
      const findExistingMatch = async (currentMatch, nextMatch) => {
        return await Match.findOne({
          $or: [
            { previousMatches: { $all: [currentMatch._id, nextMatch?._id] } },
            { previousMatches: currentMatch._id },
            { previousMatches: nextMatch?._id }
          ]
        }).session(session);
      };

      for (let i = 0; i < matches.length; i += 2) {
        const [currentMatch, nextMatch] = await Promise.all([
          Match.findById(matches[i]._id).session(session),
          matches[i + 1] ? Match.findById(matches[i + 1]._id).session(session) : null
        ]);

        const stage = getStageFromRound(roundNumber);
        const isFinal = stage === 'final';

        // Buscar match existente con lógica mejorada
        const existingMatch = await findExistingMatch(currentMatch, nextMatch);

        if (!existingMatch) {
          const participants = [
            currentMatch?.winner || null,
            nextMatch?.winner || null
          ];

          const newMatch = new Match({
            tournament: tournamentId,
            stage,
            status: 'pending',
            participants: isFinal ? participants : participants.filter(Boolean),
            previousMatches: [
              currentMatch._id,
              ...(nextMatch ? [nextMatch._id] : [])
            ].filter(Boolean)
          });

          await newMatch.save({ session });

          // Actualizar referencias bidireccionales
          await Match.updateMany(
            { _id: { $in: [currentMatch._id, nextMatch?._id] } },
            { $set: { nextMatchId: newMatch._id } },
            { session }
          );

          nextMatches.push(newMatch);
        } else {
          // Actualizar match existente con nuevos participantes
          const winnerFromCurrent = currentMatch.winner;
          const winnerFromNext = nextMatch?.winner;

          if (winnerFromCurrent && !existingMatch.participants.includes(winnerFromCurrent)) {
            existingMatch.participants.push(winnerFromCurrent);
          }

          if (winnerFromNext && !existingMatch.participants.includes(winnerFromNext)) {
            existingMatch.participants.push(winnerFromNext);
          }

          existingMatch.status = existingMatch.participants.length >= 2 ? 'scheduled' : 'pending';
          await existingMatch.save({ session });

          nextMatches.push(existingMatch);
        }
      }

      if (nextMatches.length > 0 && getStageFromRound(roundNumber) !== 'final') {
        await generateNextRounds(nextMatches, roundNumber + 1);
      }
    };

    await generateNextRounds(firstRoundMatches);

    // 6. Manejo especial para la consolación
    const consolationMatch = new Match({
      tournament: tournamentId,
      stage: 'consolation',
      status: 'pending',
      isThirdPlaceMatch: true
    });
    await consolationMatch.save({ session });



    await session.commitTransaction();

    return GetBracketStructure(tournamentId); // Usar función existente

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
// Función auxiliar para determinar rondas
function getStageFromRound(round) {
  const stageMap = {
    1: 'finals',
    2: 'semifinal',
    3: 'final'
  };
  return stageMap[round] || 'final';
}


const GetBracketStructure = async (tournamentId) => {
  try {
    // Obtener todos los matches del torneo (excluyendo grupos y match de consolación para el tercer puesto)
    const allMatches = await Match.find({
      tournament: tournamentId,
      stage: { $nin: ['group', 'consolation'] }
    })
      .populate({
        path: 'participants winner',
        select: '-__v'
      })
      .sort({ stage: 1 });

    // Obtener el partido de consolación (para el tercer puesto)
    const thirdPlaceMatch = await Match.findOne({
      tournament: tournamentId,
      stage: 'consolation'
    })
      .populate('participants winner');

    // Mapear los partidos (matchlist)
    const matchlist = allMatches.map(match => ({
      id: match._id,
      round: getRoundNumber(match.stage),
      participant1: match.participants[0]
        ? {
            _id: match.participants[0]._id,
            name: match.participants[0].name,
            ...(match.participants[0].isBye && {
              _id: `BYE-${match.participants[0]._id}`,
              name: 'BYE',
              isBye: true
            })
          }
        : undefined,
      participant2: match.participants[1]
        ? {
            _id: match.participants[1]._id,
            name: match.participants[1].name,
            ...(match.participants[1].isBye && {
              _id: `BYE-${match.participants[1]._id}`,
              name: 'BYE',
              isBye: true
            })
          }
        : undefined,
      ...(match.nextMatchId && { nextMatchId: match.nextMatchId }),
      ...(match.status === 'completed' && { winner: match.winner })
    }));

    // Inicializar top4 en null. Lo definiremos si el partido final ya terminó.
    let top4 = null;
    // Buscar el partido de final dentro de allMatches (stage === 'final')
    const finalMatch = allMatches.find(match => match.stage === 'final');

    if (finalMatch && finalMatch.status === 'completed') {
      // Primero: ganador de la final
      const first = finalMatch.winner;
      // Segundo: el que perdió la final (el participante que no es el ganador)
      let second = null;
      if (finalMatch.participants && finalMatch.participants.length === 2) {
        if (String(finalMatch.participants[0]._id) === String(finalMatch.winner._id)) {
          second = finalMatch.participants[1];
        } else {
          second = finalMatch.participants[0];
        }
      }

      // Para el tercer y cuarto puesto, usamos el partido de consolación
      let third = null;
      let fourth = null;
      if (thirdPlaceMatch && thirdPlaceMatch.status === 'completed' && thirdPlaceMatch.participants && thirdPlaceMatch.participants.length === 2) {
        third = thirdPlaceMatch.winner;
        if (String(thirdPlaceMatch.participants[0]._id) === String(thirdPlaceMatch.winner._id)) {
          fourth = thirdPlaceMatch.participants[1];
        } else {
          fourth = thirdPlaceMatch.participants[0];
        }
      }
      top4 = { first, second, third, fourth };
    }

    return {
      matchlist,
      thirdplacematch: thirdPlaceMatch
        ? {
            id: thirdPlaceMatch._id,
            round: getRoundNumber('consolation'),
            isThirdPlaceMatch: true,
            participant1: thirdPlaceMatch.participants[0]
              ? {
                  _id: thirdPlaceMatch.participants[0]._id,
                  name: thirdPlaceMatch.participants[0].name
                }
              : undefined,
            participant2: thirdPlaceMatch.participants[1]
              ? {
                  _id: thirdPlaceMatch.participants[1]._id,
                  name: thirdPlaceMatch.participants[1].name
                }
              : undefined,
            ...(thirdPlaceMatch.status === 'completed' && { winner: thirdPlaceMatch.winner })
          }
        : null,
      // Se incluye top4 sólo si el partido de final ya tiene ganador
      ...(top4 && { top4 })
    };

  } catch (error) {
    throw new Error(`Error obteniendo estructura del bracket: ${error.message}`);
  }
};


// Función auxiliar (la misma que en el método anterior)
function getRoundNumber(stage) {
  const roundMap = {
    'finals': 1,
    'semifinal': 2,
    'final': 3,
    'consolation': 3
  };
  return roundMap[stage] || 1;
}



const UpdateBracketMatch = async (tournamentId, matchId, winnerId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await Tournament.findById(tournamentId)
      .populate({
        path: 'finalsBracket.rounds.matches.matchId',
        model: 'Match'
      })
      .session(session);

    const match = tournament.finalsBracket.rounds
      .flatMap(r => r.matches)
      .find(m => m.matchId._id.equals(matchId));

    // Actualizar match
    match.matchId.winner = winnerId;
    match.matchId.status = 'completed';
    await match.matchId.save({ session });

    // Avanzar al siguiente round
    if (!match.isThirdPlace) {
      await advanceWinner(tournament, match, winnerId, session);
    }

    // Manejar tercer lugar
    if (match.matchId.stage === 'semifinal') {
      const loser = match.matchId.participants.find(p => !p.equals(winnerId));
      await addParticipantToThirdPlace(tournament, loser, session);
    }

    await tournament.save({ session });
    await session.commitTransaction();

    return tournament;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const advanceWinner = async (tournament, currentMatch, winnerId, session) => {
  const nextRound = tournament.finalsBracket.rounds
    .find(r => r.roundNumber === currentMatch.roundNumber + 1);

  if (nextRound) {
    const nextMatchIndex = Math.floor(currentMatch.matchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIndex];

    if (!nextMatch.matchId.participants.includes(winnerId)) {
      nextMatch.matchId.participants.push(winnerId);
      await nextMatch.matchId.save({ session });
    }
  }
};

const addParticipantToThirdPlace = async (tournament, participantId, session) => {
  const thirdPlaceRound = tournament.finalsBracket.rounds
    .find(r => r.matches.some(m => m.isThirdPlace));

  const thirdPlaceMatch = thirdPlaceRound.matches[0];

  if (!thirdPlaceMatch.matchId.participants.includes(participantId)) {
    thirdPlaceMatch.matchId.participants.push(participantId);
    await thirdPlaceMatch.matchId.save({ session });
  }
};

const AddSetToFinalMatch = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionStarted = false;

  try {
    // Iniciar transacción
    await session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      maxTimeMS: 5000
    });
    transactionStarted = true;

    const { matchId } = req.query;
    const { participant1Points, participant2Points } = req.body;

    // Validaciones
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      throw new Error('ID de match inválido');
    }

    // Obtener match dentro de la transacción
    const match = await Match.findById(matchId)
      .populate('participants')
      .session(session);

    if (!match) throw new Error('Match no encontrado');
    if (!['ongoing', 'scheduled', 'pending'].includes(match.status)) {
      throw new Error('Match no está en curso');
    }

    // Lógica de sets
    const [p1, p2] = match.participants;
    const winner = participant1Points > participant2Points ? p1 : p2;
    const newSet = {
      player1Points: participant1Points,
      player2Points: participant2Points,
      winner: winner._id,
      winnerDetails: { // Incluir detalles del ganador
        _id: winner._id,
        name: winner.name
      }
    };

    match.sets.push(newSet);

    // Incrementar totalSets del ganador del set
    await Participant.updateOne(
      { _id: winner._id },
      { $inc: { totalSets: 1 } },
      { session }
    );

    // Verificar victoria del partido
    const victoryCount = match.sets.reduce((acc, set) => {
      acc[set.winner.toString()] = (acc[set.winner.toString()] || 0) + 1;
      return acc;
    }, {});

    const matchWinner = Object.entries(victoryCount).find(([, wins]) => wins >= 2)?.[0];

    if (matchWinner) {
      match.status = 'completed';
      match.winner = matchWinner;
      await Participant.findByIdAndUpdate(matchWinner, { $inc: { victories: 1 } }, { session });

      // Avanzar al ganador a la siguiente ronda
      const advanceResult = await AdvanceWinnerToNextRound(match._id, matchWinner, session);

      // Emitir actualización por socket
      Socket.io.emit('update-final-match', {
        matchId: match._id,
        winnerId: matchWinner,
        ...advanceResult
      });
    } else {
      match.status = 'ongoing';
    }

    // Guardar cambios y commit
    await match.save({ session });
    await session.commitTransaction();
    transactionStarted = false;

    // Preparar respuesta
    const response = {
      currentSet: match.sets.length,
      addedSet: {
        player1Points: newSet.player1Points,
        player2Points: newSet.player2Points,
        winner: newSet.winnerDetails // Incluir detalles del ganador
      },
      matchStatus: match.status,
      winner: matchWinner ? {
        _id: matchWinner,
        name: matchWinner === p1._id.toString() ? p1.name : p2.name
      } : null,
      nextAction: matchWinner ? 'Match finalizado' : `Continuar al set ${match.sets.length + 1}`
    };

    res.status(200).json(response);

  } catch (error) {
    if (transactionStarted) {
      await session.abortTransaction();
    }

    console.error('Error en AddSetToFinalMatch:', error);
    res.status(error instanceof mongoose.Error.ValidationError ? 400 : 500).json({
      message: 'Error en la operación',
      error: error.message
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

const AdvanceWinnerToNextRound = async (matchId, winnerId, session) => {
  const currentMatch = await Match.findById(matchId)
    .populate('participants')
    .session(session);

  if (!currentMatch) throw new Error('Match no encontrado');


  if (currentMatch.stage === 'consolation') {
    if (!currentMatch.participants.some(p => p._id.equals(winnerId))) {
      throw new Error('Ganador no válido para consolación');
    }
    
    currentMatch.winner = winnerId;
    currentMatch.status = 'completed';
    await currentMatch.save({ session });
    
    return { 
      message: 'Ganador de consolación registrado',
      isConsolation: true 
    };
  }


  // Verificar si el match contiene BYE
  const hasBye = currentMatch.participants.some(p => p.isBye);

  // Si es un BYE, forzar el ganador automático
  if (hasBye) {
    winnerId = currentMatch.participants.find(p => !p.isBye)._id;
  }

  if (!currentMatch.participants.some(p => p._id.equals(winnerId))) {
    throw new Error('El ganador no es un participante válido');
  }

  // Buscar siguiente match usando nextMatchId
  const nextMatch = await Match.findById(currentMatch.nextMatchId)
    .session(session);

  if (nextMatch) {
    // Determinar posición basado en previousMatches
    const position = nextMatch.previousMatches.findIndex(id => id.equals(currentMatch._id));

    // Lógica de posicionamiento mejorada
    if (position >= 0) {
      if (!nextMatch.participants[position]) {
        nextMatch.participants[position] = winnerId;
      } else if (!nextMatch.participants.includes(winnerId)) {
        nextMatch.participants.push(winnerId);
      }
    } else {
      nextMatch.participants.push(winnerId);
    }


    // Actualizar estado si está listo
    if (nextMatch.participants.length >= 2) {
      nextMatch.status = 'scheduled';
    }
    if (currentMatch.stage === 'semifinal') {
      const loser = currentMatch.participants.find(p => !p._id.equals(winnerId));

      // Buscar match de consolación
      const consolationMatch = await Match.findOne({
        tournament: currentMatch.tournament,
        stage: 'consolation',
      }).session(session);

      if (consolationMatch) {
        // Agregar perdedor si no existe
        if (!consolationMatch.participants.some(p => p.equals(loser._id))) {
          consolationMatch.participants.push(loser._id);

          // Actualizar estado si ya tiene 2 participantes
          if (consolationMatch.participants.length === 2) {
            consolationMatch.status = 'scheduled';
          }

          await consolationMatch.save({ session });
        }
      }
    }

    await nextMatch.save({ session });
    return { nextMatchId: nextMatch._id };
  }


  // Solo verificar matches pendientes si es la final
  if (currentMatch.stage === 'final') {
    const pendingMatches = await Match.countDocuments({
      tournament: currentMatch.tournament,
      status: { $nin: ['completed', 'scheduled', 'pending'] },
      stage: { $nin: ['consolation'] }
    }).session(session);

    if (pendingMatches > 1) {
      throw new Error(`Matches pendientes: ${pendingMatches}`);
    }

    // Finalizar torneo
    const tournament = await Tournament.findByIdAndUpdate(
      currentMatch.tournament,
      { winner: winnerId, status: 'completed' },
      { session }
    );

    return { tournamentCompleted: true };
  }

  throw new Error('No se encontró siguiente match para un partido no final');
};



const GetTop4 = async (tournamentId) => {
  try {
    // Buscar el partido final del torneo y poblar participantes y ganador
    const finalMatch = await Match.findOne({
      tournament: tournamentId,
      stage: 'final'
    }).populate('participants winner');

    // Si no existe el partido final o no está completado, no se puede determinar el top 4
    if (!finalMatch || finalMatch.status !== 'completed') {
      return { top4: null };
    }

    // Primer puesto: ganador de la final
    const first = finalMatch.winner;

    // Segundo puesto: el participante que no ganó la final
    let second = null;
    if (finalMatch.participants && finalMatch.participants.length === 2) {
      second = String(finalMatch.participants[0]._id) === String(finalMatch.winner._id)
        ? finalMatch.participants[1]
        : finalMatch.participants[0];
    }

    // Buscar el partido de consolación para determinar el tercer y cuarto puesto
    const thirdPlaceMatch = await Match.findOne({
      tournament: tournamentId,
      stage: 'consolation'
    }).populate('participants winner');

    let third = null;
    let fourth = null;
    if (thirdPlaceMatch && thirdPlaceMatch.status === 'completed' && thirdPlaceMatch.participants && thirdPlaceMatch.participants.length === 2) {
      third = thirdPlaceMatch.winner;
      fourth = String(thirdPlaceMatch.participants[0]._id) === String(thirdPlaceMatch.winner._id)
        ? thirdPlaceMatch.participants[1]
        : thirdPlaceMatch.participants[0];
    }

    return {
      top4: {
        first,
        second,
        third,
        fourth
      }
    };

  } catch (error) {
    throw new Error(`Error obteniendo top 4: ${error.message}`);
  }
};



//#endregion


module.exports = {
  getAvailableParticipants: GetAvailableParticipants,
  startNewMatch: StartNewMatch,
  getMatchDetails: GetMatchDetails,
  addSetToMatch: AddSetToMatch,
  initializeFinalsBracket: InitializeFinalsBracket,
  getBracketStructure: GetBracketStructure,
  updateBracketMatch: UpdateBracketMatch,
  getMatchDetailsForFinals: GetMatchDetailsForFinals,
  addSetToFinalMatch: AddSetToFinalMatch,
  getTop4: GetTop4
}