 const Participant = require('../Model/Participant');
const Group = require('../../Group/Model/Group')

 const getTheBestGroup = require('../utils/GetTheBestGroup')

 
 const GetParticipants = async (req, res) => {
   try{
     const participants = await Participant.find();
     res.status(200).send({ok: true, message: 'Participantes encontrados', participants});
   }catch(error){
     console.error(error);
     res.status(500).send('Error al obtener los participantes');
   }
 }

const CreateParticipant = async (req, res) => {
  try {

    const { name, region, tournamentID } = req.body;
    
    participant = await Participant.findOne({name: name});

    if (participant) {
    res.status(409).send('Ya existe un participante con ese nombre');
      return;
    }

    
    
    const group = getTheBestGroup({name: name, region: region}, await Group.find({tournament: tournamentID}));

    

    const newParticipant = new Participant({
      name,
      region,
      group: group._id,
      tournament: tournamentID
    });

    await newParticipant.save();
    group.participants.push(newParticipant._id)
 
    await group.save();
    res.status(201).send({ok: true, message:'Participante creado exitosamente', participant: newParticipant});
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear el participante');
  }
}


module.exports = {
getAllParticipants: GetParticipants,
createParticipant: CreateParticipant

}
