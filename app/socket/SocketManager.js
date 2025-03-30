const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();
const env = process.env;

class SocketManager {
  static instance = null; // Almacena la instancia Singleton

  // Método estático para obtener la instancia Singleton
  static getInstance(server) {
    if (!SocketManager.instance) {
      if (!server) {
        throw new Error('Se requiere el servidor para crear la instancia inicial');
      }
      SocketManager.instance = new SocketManager(server);
    }
    return SocketManager.instance;
  }

  constructor(server) {
    if (SocketManager.instance) { // Evita nueva instancia con 'new'
      throw new Error('Usa SocketManager.getInstance() para obtener la instancia Singleton');
    }

    // Configuración original del servidor Socket.io
    this.io = new Server(server, {
      cors: {
        origin: '*'
      },
    });


    this.setupConnection();
  }

  setupConnection() {
    console.log('CORS Origins:', env.FRONT_URL_DEBUG, env.FRONT_URL_RELEASE);
    this.io.on('connection', (socket) => {
      console.log('Cliente conectado:', socket.id);
      socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
      });

    });
  }

  setupModelHooks(model) {
    model.schema.post('save', (doc) => {
    });

    model.schema.post('findOneAndUpdate', (doc) => {
      this.io.emit('registro-actualizado', doc);
    });
  }
}

module.exports = SocketManager;