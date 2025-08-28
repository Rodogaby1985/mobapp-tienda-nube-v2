// src/utils/logger.js v1.0
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} - ${info.level.toUpperCase()} - ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        // Opcional: Para guardar logs en un archivo (descomentar para producción)
        // new winston.transports.File({ filename: 'app.log' })
    ],
});

module.exports = logger;