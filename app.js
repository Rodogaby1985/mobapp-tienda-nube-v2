// app.js V2.2
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const logger = require('./src/utils/logger');
const authRoutes = require('./src/routes/authRoutes');
const shippingRoutes = require('./src/routes/shippingRoutes');
const { loadAllSheetDataIntoCache } = require('./src/services/googleSheetsService');

// Cargar variables de entorno del archivo .env
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Para desarrollo, cambiar a true en producción
}));

// Rutas
app.use('/', authRoutes);
app.use('/api', shippingRoutes);

// Manejador de errores
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.stack}`);
    res.status(500).send('Internal Server Error');
});

// Iniciar el servidor
app.listen(port, async () => {
    logger.info(`Servidor Node.js escuchando en el puerto ${port}`);
    logger.info(`URL Pública de la API (actualmente en .env): ${process.env.PUBLIC_API_URL}`);
    logger.info("Asegúrate de que esta URL sea accesible desde internet para Tienda Nube.");
    logger.info("Visita /install en tu navegador para iniciar la instalación de la app.");
    
    // CORRECCIÓN CRÍTICA: Se llama a la función para cargar los datos en la caché al iniciar la aplicación.
    await loadAllSheetDataIntoCache();
});
