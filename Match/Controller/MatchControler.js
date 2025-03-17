const mongoose = require('mongoose')

const Match = require('../Model/Match');
const Group = require('../../Group/Model/Group');
const Participant = require('../../Participant/Model/Participant');

const SocketManager = require('../../app/socket/SocketManager');

Socket = SocketManager.getInstance();

const GetAvailableParticipants = async (req, res) =>{
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
    await group.save({ session});
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

    const Match = mongoose.model('Match');
    const Group = mongoose.model('Group');

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
    if (match.status !== 'ongoing') throw new Error('Match no está en curso');

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
      options: { sort: {victories: -1, totalSets: -1, groupPoints: -1 } } // Ordenar por puntuación
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

    try{

      Socket.io.emit('update-set', groupUpdateData);
    }catch(err){
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


module.exports ={
  getAvailableParticipants: GetAvailableParticipants,
  startNewMatch: StartNewMatch,
  getMatchDetails: GetMatchDetails,
  addSetToMatch: AddSetToMatch
}