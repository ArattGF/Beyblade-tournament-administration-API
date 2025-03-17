const Group = require('../Model/Group');
const Tournament = require('../../Tournament/Model/Tournament');
const Participant= require('../../Participant/Model/Participant');

const getAlphabeticArray = require('../utils/AlphabeticNumeration');

const GetAllGroups = async (req, res) => {
  try {
    // 1. Buscar el torneo activo
    const tournament = await Tournament.findOne({ status: { $ne: 'completed' } });
    
    if (!tournament) {
      return res.status(204).send({ ok: true, message: 'No hay torneo en curso', groups: [] });
    }

    // 2. Agregación para obtener grupos con participantes ordenados
    const groups = await Participant.aggregate([
      {
        $match: {
          tournament: tournament._id,
          group: { $exists: true, $ne: null } // Solo participantes con grupo asignado
        }
      },
      {
        $lookup: {
          from: 'groups', // Nombre de la colección de grupos
          localField: 'group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      { $unwind: '$groupInfo' },
      {
        $group: {
          _id: '$group',
          identifier: {$first: '$groupInfo._id'},
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
                totalPoints: -1,
                victories: -1,
                sets: -1
              }
            }
          }
        }
      },
      {
        $sort: {
          name: 1 // 1 = orden ascendente (A-Z)
        }
      }
    ]);

    // 3. Si no hay grupos con participantes
    if (groups.length === 0) {
      return res.status(204).send({ 
        ok: true, 
        message: 'No hay grupos con participantes', 
        groups: [] 
      });
    }

    // 4. Respuesta exitosa
    res.status(200).send({
      ok: true,
      message: 'Datos de grupos obtenidos',
      groups: groups,
      tournamentName: tournament.name
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