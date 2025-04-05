const Group = require('../Model/Group');
const Tournament = require('../../Tournament/Model/Tournament');
const Participant= require('../../Participant/Model/Participant');
const Match = require('../../Match/Model/Match')

const getAlphabeticArray = require('../utils/AlphabeticNumeration');

const GetAllGroups = async (req, res) => {
  try {
    // 1. Buscar primero torneo activo (no completado)
    let tournament = await Tournament.findOne({ status: { $ne: 'completed' } });

    // Si no hay activo, buscar el último torneo completado
    if (!tournament) {
      tournament = await Tournament.findOne({ status: 'completed' })
        .sort({ _id: -1 }); // Ordenar por ID descendente para obtener el más reciente
    }

    // Si no hay ningún torneo en absoluto
    if (!tournament) {
      return res.status(204).send({ 
        ok: true, 
        message: 'No hay torneos existentes', 
        groups: [] 
      });
    }


    // 2. Agregación para obtener grupos con participantes ordenados
    const groups = await Participant.aggregate([
      {
        $match: {
          tournament: tournament._id,
          group: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      { $unwind: '$groupInfo' },
      {
        $group: {
          _id: '$group',
          identifier: { $first: '$groupInfo._id' },
          groupName: { $first: '$groupInfo.name' },
          participants: {
            $push: {
              _id: '$_id',
              name: '$name',
              region: '$region',
              victories: '$victories',
              points: '$groupPoints',
              sets: '$totalSets',
              totalPoints: { $add: ['$groupPoints', '$elimPoints'] }
            }
          }
        }
      },
      {
        $project: {
          _id: '$identifier',
          name: '$groupName',
          participants: {
            $sortArray: {
              input: '$participants',
              sortBy: {
                victories: -1,
                sets: -1,
                totalPoints: -1
              }
            }
          }
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);

    if (groups.length === 0) {
      return res.status(204).send({ 
        ok: true, 
        message: 'No hay grupos con participantes', 
        groups: [] 
      });
    }

    // 3. Verificar etapa de grupos completada para cada grupo
    const groupsWithStatus = await Promise.all(groups.map(async (group) => {
      const participantCount = group.participants.length;
      let groupStageEnded = false;

      if (participantCount >= 2) {
        const requiredMatches = (participantCount * (participantCount - 1)) / 2;

        // Agregación para contar enfrentamientos únicos completados
        const uniqueMatchesCount = await Match.aggregate([
          {
            $match: {
              group: group._id,
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

      return {
        ...group,
        groupStageEnded
      };
    }));
    res.status(200).send({
      ok: true,
      message: tournament.status === 'completed' 
        ? 'Datos de grupos del último torneo completado' 
        : 'Datos de grupos del torneo en curso',
      groups: groupsWithStatus,
      tournamentName: tournament.name,
      tournamentId: tournament._id,
      tournamentStage: tournament.status
    });

  } catch (error) {
    console.error('Error en GetAllGroups:', error);
    res.status(500).send({
      ok: false,
      message: 'Error interno al obtener grupos',
      error: error.message
    });
  }
};

const CreateGroup = async (req, res) => {
  try {
    const { tournamentID } = req.body;
    const tournament = await Tournament.findById(tournamentID);
    
    if (!tournament) return res.status(404).send('Torneo no encontrado');
    if (tournament.groups.length > 0) return res.status(409).send('Ya se han creado los grupos');

    const names = getAlphabeticArray(tournament.numberOfGroups);
    
    // Crear y guardar todos los grupos en paralelo
    const groupPromises = names.map(async (name) => {
      const newGroup = new Group({
        tournament: tournamentID,
        name,
        max: tournament.maxParticipantsPerGroup
      });
      await newGroup.save();
      return newGroup._id;
    });

    const groups = await Promise.all(groupPromises);

    tournament.groups = groups;
    tournament.status = 'group';
    await tournament.save();

    res.status(201).send({ 
      ok: true, 
      message: 'Grupos creados exitosamente', 
      tournamentID: tournament._id 
    }); 
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear el grupo');
  }
}



module.exports = {
  getAllGroups: GetAllGroups,
  createGroup: CreateGroup
}