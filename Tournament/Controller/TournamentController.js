const Tournament = require('../Model/Tournament');

const CreateTournament = async (req, res) => {
  try {
    const { name, numberOfGroups, maxParticipantsPerGroup } = req.body;

    const newTournament = new Tournament({
      name,
      numberOfGroups,
      maxParticipantsPerGroup
    });
 
    const existingTournament = await Tournament.findOne({ status: { $ne: 'completed' } });
    if (existingTournament) {
      return res.status(409).send('Ya existe un torneo en curso');
    }
    await newTournament.save();

    res.status(201).send({ok: true, message:'Torneo creado exitosamente', tournamentID: newTournament._id});
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear el torneo');
  }
};

const GetCurrentTournament = async (req, res) => {
  try{

    const existingTournament = await Tournament.findOne({ status: { $ne: 'completed' } });
    
    if (!existingTournament) {
      return res.status(204).send({ok: true, message: 'No hay torneos en curso', tournamentID: null});
    }
    res.status(200).send({ok: true, message: 'Torneo encontrado, redireccionando...', tournament: existingTournament});
    
  }catch(error){
    console.error(error);
    res.status(500).send('Error al obtener el torneo');
  }

};

const ChangePhase = async (req, res) =>{
  try{
    const { tournamentID } = req.body;
    const phase = req.query.stage;
 
    const existingTournament = await Tournament.findById(tournamentID);
    
    if (!existingTournament) {
    
      return res.status(409).send({ok: false, message: 'No existe el torneo', tournamentID: null});

    }

    existingTournament.status = phase;

    existingTournament.save()
      
    res.status(200).send({ok: true, message: `Torneo ${existingTournament.name} ha avanzado de fase`, tournament: existingTournament});
    
  }catch(error){
    
    console.error(error);
    res.status(500).send('Error al cambiar de fase');
  }
}




module.exports = {
  createTournament: CreateTournament,
  getCurrentTournament:  GetCurrentTournament,
  changePhase: ChangePhase
};