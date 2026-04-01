/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Conexión a la base de datos MongoDB.
 * Sin esta conexión, el servidor no puede leer ni guardar
 * ningún dato (productos, clientes, pedidos).
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lee la dirección de la base de datos desde el archivo .env
 * 2. Intenta conectarse a MongoDB Atlas (la base de datos en la nube)
 * 3. Si la conexión falla, el servidor se detiene para evitar
 *    operar sin acceso a los datos
 * 4. Registra eventos de desconexión inesperada para alertar al equipo
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El servidor no arranca? → Verificar MONGO_URI en el archivo .env
 * - ¿Error "Authentication failed"? → El usuario o contraseña del URI son incorrectos
 * - ¿Error de timeout? → La IP del servidor no está en la lista blanca de MongoDB Atlas
 *   (Network Access → Add IP Address en el panel de Atlas)
 * - ¿Se desconecta en producción? → Revisar el plan de Atlas (M0 tiene límite de conexiones)
 * - Documentación oficial: https://mongoosejs.com/docs/guide.html
 * ======================================================
 */

import mongoose from 'mongoose';

// ======== CONEXIÓN A LA BASE DE DATOS ========
// Esta función se llama una sola vez al arrancar el servidor.
// Si falla, el proceso se detiene completamente (process.exit(1))
// porque un servidor sin base de datos no puede funcionar.
// ¿No arranca el servidor? Revisar MONGO_URI en el .env
export const conectarDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

        await mongoose.connect(uri, {
            // Tiempo máximo para encontrar un servidor disponible en el cluster
            serverSelectionTimeoutMS: 5000,
            // Tiempo máximo de espera para que una operación (query) termine
            socketTimeoutMS: 45000
        });

        console.log('✅ Conectado a MongoDB correctamente');

        // ======== VIGILANCIA DE CONEXIÓN ========
        // Si la base de datos se desconecta después de conectarse con éxito,
        // estos eventos registran el problema para que se pueda detectar a tiempo.
        // ¿Los pedidos dejan de guardarse de golpe? Buscar estos mensajes en los logs.
        mongoose.connection.on('disconnected', () => {
            console.error('⚠️  MongoDB desconectado inesperadamente. Las operaciones de base de datos fallarán hasta reconectar.');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconectado correctamente');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ Error de conexión MongoDB:', err.message);
        });

    } catch (error) {
        console.error('❌ No se pudo conectar a MongoDB:', error.message);
        // Detener el servidor — operar sin base de datos causaría errores silenciosos
        process.exit(1);
    }
};
