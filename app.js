// app.js V2.2 DOMICILIO
'use strict';

// Cargar variables de entorno
require('dotenv').config();

// Dependencias
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');

const logger = require('./src/utils/logger');
const authRoutes = require('./src/routes/authRoutes');
const shippingRoutes = require('./src/routes/shippingRoutes');
const { loadAllSheetDataIntoCache } = require('./src/services/googleSheetsService');

// App
const app = express();

// Configuración básica
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MODALIDAD = process.env.MODALIDAD || 'sucursal';

// Si estás detrás de proxy (Traefik/Caddy de Coolify)
app.set('trust proxy', 1);

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session (usa APP_SECRET_KEY que ya definiste en Coolify; fallback a SESSION_SECRET)
app.use(
  session({
    secret: process.env.APP_SECRET_KEY || process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // pon true si sirves solo por HTTPS
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Exponer modalidad a todas las rutas
app.use((req, _res, next) => {
  req.modality = MODALIDAD;
  next();
});

// Rutas
app.use('/', authRoutes);
app.use('/api', shippingRoutes);

// Manejador de errores
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err.stack || err}`);
  res.status(500).send('Internal Server Error');
});

// Arranque del servidor
app.listen(PORT, HOST, () => {
  logger.info(`Servidor Node.js (MODALIDAD=${MODALIDAD}) escuchando en http://${HOST}:${PORT}`);
  logger.info(`PUBLIC_API_URL: ${process.env.PUBLIC_API_URL || 'NO DEFINIDA'}`);
  if (!process.env.PUBLIC_API_URL) {
    logger.warn('PUBLIC_API_URL no está definida. Tienda Nube necesitará una URL pública.');
  }
  logger.info('Visita /install para iniciar la instalación (SUCURSAL).');

  // Carga inicial de caché (no bloqueante)
  loadAllSheetDataIntoCache()
    .then(() => logger.info('Cache inicial cargada (Google Sheets).'))
    .catch((e) => logger.error('Error al cargar datos iniciales en cache: ' + (e?.message || e)));
});

module.exports = app;
