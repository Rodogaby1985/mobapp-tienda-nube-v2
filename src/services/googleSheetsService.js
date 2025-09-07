// src/services/googleSheetsService.js V5.7
const { google } = require('googleapis');
const logger = require('../utils/logger');
const path = require('path');

let sheetsClient = null;
let sheetDataCache = {};

const getSheetsClient = async () => {
    if (sheetsClient) {
        return sheetsClient;
    }

    try {
        const credentialsPath = path.resolve(process.env.GCP_CREDENTIALS_PATH);
        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        sheetsClient = google.sheets({ version: 'v4', auth });
        logger.info("Cliente de Google Sheets inicializado correctamente.");
        return sheetsClient;
    } catch (error) {
        logger.error(`Error al inicializar el cliente de Google Sheets: ${error.message}`, error);
        throw new Error("No se pudieron cargar las credenciales de Google Sheets.");
    }
};

const POSTAL_CODES_SHEET_NAME = "CODIGOS POSTALES";
const RATE_SHEET_NAMES = [
    "ANDREANI SUC", "ANDREANI DOM", "CA SUC", "CA DOM", "OCA SUC", "OCA DOM", "URBANO", "ANDREANI BIGGER A DOM"
];

const loadAllSheetDataIntoCache = async () => {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        const postalCodesRange = `${POSTAL_CODES_SHEET_NAME}!A:C`;
        const postalCodesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: postalCodesRange });
        sheetDataCache[POSTAL_CODES_SHEET_NAME] = postalCodesResponse.data.values;
        logger.info(`Cargando y cacheadno el tarifario de "${POSTAL_CODES_SHEET_NAME}". Registros: ${sheetDataCache[POSTAL_CODES_SHEET_NAME].length}`);

        for (const sheetName of RATE_SHEET_NAMES) {
            const ratesRange = `${sheetName}!A:Z`;
            const ratesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: ratesRange });
            sheetDataCache[sheetName] = ratesResponse.data.values;
            logger.info(`Cargando y cacheadno el tarifario de "${sheetName}". Registros: ${sheetDataCache[sheetName].length}`);
        }
        logger.info("Todos los tarifarios de Google Sheets han sido cargados en la caché.");
    } catch (error) {
        logger.error(`Error al cargar los datos en la caché: ${error.message}`, error);
    }
};

const getProvinceFromPostalCode = (postalCode) => {
    try {
        const rows = sheetDataCache[POSTAL_CODES_SHEET_NAME];
        if (!rows || rows.length === 0) {
            logger.warn(`No se encontraron datos en la caché para la hoja "${POSTAL_CODES_SHEET_NAME}".`);
            return null;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);
        const cpHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'CP');
        const provinceHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'PROVINCIA');

        if (cpHeaderIndex === -1 || provinceHeaderIndex === -1) {
            logger.error(`No se encontraron los encabezados 'CP' or 'Provincia' en la caché.`);
            return null;
        }

        const foundRow = dataRows.find(row => row[cpHeaderIndex] === postalCode);

        if (foundRow) {
            const province = foundRow[provinceHeaderIndex];
            logger.info(`Código Postal ${postalCode} encontrado en la caché. Provincia: ${province}`);
            return province;
        }

        logger.warn(`No se encontró la provincia para el Código Postal ${postalCode}.`);
        return null;
    } catch (error) {
        logger.error(`Error al obtener la provincia del código postal desde la caché: ${error.message}`, error);
        return null;
    }
};

const getShippingRatesFromSheet = (sheetName, weightKg, postalCode) => {
    if (!postalCode || isNaN(parseInt(postalCode))) {
        logger.warn("No se puede calcular el envío sin un código postal válido.");
        return [];
    }

    try {
        const rows = sheetDataCache[sheetName];
        if (!rows || rows.length === 0) {
            logger.warn(`No se encontraron datos en la caché para la hoja "${sheetName}".`);
            return [];
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        logger.info(`Consultando tarifario de "${sheetName}" desde la caché.`);
        
        const pesoMinHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'PESO MIN');
        const pesoMaxHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'PESO MAX');
        const precioHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'PRECIO');
        const provinciaHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'PROVINCIA');
        const tituloHeaderIndex = headers.findIndex(h => h.trim().toUpperCase() === 'TÍTULO');

        if (pesoMinHeaderIndex === -1 || pesoMaxHeaderIndex === -1 || precioHeaderIndex === -1 || provinciaHeaderIndex === -1 || tituloHeaderIndex === -1) {
            logger.warn(`Encabezado(s) faltante(s) en la hoja "${sheetName}". Saltando esta hoja.`);
            return [];
        }

        const targetProvince = getProvinceFromPostalCode(postalCode);
        if (!targetProvince) {
            return [];
        }

        // ========== FRAGMENTO MODIFICADO ==========
        // TODAS las opciones serán tipo 'ship' (envío a domicilio)
        // La diferenciación será solo por el título/nombre del servicio
        const deliveryType = 'ship';
        // ========== FIN DE MODIFICACIÓN ==========
        
        const matchingRates = dataRows.filter(row => {
            const rowProvince = row[provinciaHeaderIndex];
            const pesoMin = parseFloat(row[pesoMinHeaderIndex] || 0.0);
            const pesoMax = parseFloat(row[pesoMaxHeaderIndex] || 99999999.0);

            return (
                rowProvince && rowProvince.toUpperCase() === targetProvince.toUpperCase() &&
                weightKg >= pesoMin && weightKg <= pesoMax
            );
        }).map(row => {
            const costoBase = parseFloat(row[precioHeaderIndex] || 0.0);
            const nombreServicio = row[tituloHeaderIndex];

            return {
                name: nombreServicio,
                cost: costoBase,
                delivery_type: deliveryType
            };
        });
        
        if (matchingRates.length > 0) {
            logger.info(`Tarifa encontrada en "${sheetName}" para provincia "${targetProvince}", peso ${weightKg}kg, tipo ${matchingRates[0].delivery_type}: ${JSON.stringify(matchingRates[0])}`);
            return [matchingRates[0]];
        }

        logger.info(`Total de tarifas encontradas: ${matchingRates.length}`);
        return [];

    } catch (error) {
        logger.error(`Error general en getShippingRatesFromSheet: ${error.message}`, error);
        return [];
    }
};

module.exports = {
    getSheetsClient,
    getShippingRatesFromSheet,
    loadAllSheetDataIntoCache
};