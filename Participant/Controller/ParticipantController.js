const mongoose = require('mongoose')

const Participant = require('../Model/Participant');
const Group = require('../../Group/Model/Group');
const Match = require('../../Match/Model/Match');


const getTheBestGroup = require('../utils/GetTheBestGroup');
const SocketManager = require('../../app/socket/SocketManager');

Socket = SocketManager.getInstance();

const GetParticipants = async (req, res) => {
  try {
    const groupID = req.query.groupID;

    // Obtener participantes y sus IDs
    const participants = await Participant.find({ group: groupID });
    const participantIds = participants.map(p => p._id);
    const totalParticipants = participantIds.length;

    let groupStageEnded = false;

    if (totalParticipants >= 2) {
      // Calcular total de enfrentamientos requeridos
      const requiredMatches = (totalParticipants * (totalParticipants - 1)) / 2;

      // Agregación para contar enfrentamientos únicos
      const uniqueMatchesCount = await Match.aggregate([
        {
          $match: {
            group: new mongoose.Types.ObjectId(groupID),
            status: 'completed'
          }
        },
        {
          $project: {
            sortedParticipants: {
              $sortArray: {
                input: "$participants",
                sortBy: { _id: 1 }
              }
            }
          }
        },
        {
          $group: {
            _id: "$sortedParticipants",
            count: { $sum: 1 }
          }
        },
        {
          $count: "totalUniqueMatches"
        }
      ]);

      const completedMatches = uniqueMatchesCount[0]?.totalUniqueMatches || 0;
      groupStageEnded = completedMatches >= requiredMatches;
    }

    res.status(200).send({
      ok: true,
      message: 'Participantes encontrados',
      participants,
      groupStageEnded
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los participantes');
  }
}

const CreateParticipant = async (req, res) => {
  try {


    const { name, region, tournamentID } = req.body;

    participant = await Participant.findOne({ name: name,  tournament: tournamentID});

    if (participant) {
      res.status(409).send('Ya existe un participante con ese nombre');
      return;
    }



    const group = getTheBestGroup({ name: name, region: region }, await Group.find({ tournament: tournamentID }));



    const newParticipant = new Participant({
      name,
      region,
      group: group._id,
      tournament: tournamentID
    });

    await newParticipant.save();
    group.participants.push(newParticipant._id)

    await group.save();
    
    Socket.io.emit('new-player', newParticipant);

    res.status(201).send({ ok: true, message: 'Participante creado exitosamente', participant: newParticipant });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear el participante');
  }
}


GetGroupWinners = async (req, res) => {
  try {
    const {tournamentId} = req.query;

    const groupWinners = await Participant.aggregate([
      {
        $match: {
          tournament: new mongoose.Types.ObjectId(tournamentId),
          group: { $exists: true, $ne: null }
        }
      },
      {
        $sort: {
          group: -1, // Ordenar por grupo primero
          victories: -1,
          totalSets: -1,
          groupPoints: -1
        }
      },
      {
        $group: {
          _id: "$group",
          topParticipant: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$topParticipant" }
      }
    ]);
    
    res.status(200).json({ok: true, groups: groupWinners});
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllParticipants: GetParticipants,
  createParticipant: CreateParticipant,
  getGroupWinners: GetGroupWinners

}
