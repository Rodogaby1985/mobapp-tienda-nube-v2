// src/services/tiendaNubeService.js v1.0
const axios = require('axios');
const logger = require('../utils/logger');
const { TIENDA_NUBE_API_BASE_URL, TIENDA_NUBE_API_VERSION } = require('../utils/constants');

/**
 * Registra un Shipping Carrier (transportista de envíos) en Tienda Nube.
 * @param {number} storeId - El ID de la tienda donde se registrará el carrier.
 * @param {string} accessToken - El token de acceso OAuth para la tienda.
 * @param {string} publicApiUrl - La URL pública de tu aplicación (donde Tienda Nube hará los callbacks de cotización).
 * @param {string} carrierName - El nombre del transportista que aparecerá en el checkout.
 * @returns {Promise<object>} Una promesa que resuelve con la información del carrier registrado.
 * @throws {Error} Si falla el registro del carrier.
 */
const registerShippingCarrier = async (storeId, accessToken, publicApiUrl, carrierName) => {
    // Los headers incluyen el token de autenticación y el User-Agent de tu aplicación.
    const headers = {
        "Authentication": `bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": `TiendaNubeShippingApp/${process.env.TIENDA_NUBE_CLIENT_ID}`
    };

    // Datos del carrier a registrar (sin el campo 'options' aquí)
    const carrierData = {
        name: carrierName,
        callback_url: `${publicApiUrl}/api/shipping_rates`,
        active: true,
        country_codes: ["AR"],
        types: "ship,pickup",
    };

    const requestUrl = `${TIENDA_NUBE_API_BASE_URL}/${TIENDA_NUBE_API_VERSION}/${storeId}/shipping_carriers`;

    logger.info(`[DEBUG] Registro Carrier: URL -> ${requestUrl}`);
    logger.info(`[DEBUG] Registro Carrier: Headers -> ${JSON.stringify(headers)}`);
    logger.info(`[DEBUG] Registro Carrier: Payload -> ${JSON.stringify(carrierData)}`);

    try {
        const response = await axios.post(
            requestUrl,
            carrierData,
            { headers }
        );
        logger.info(`Shipping Carrier registrado exitosamente para store_id ${storeId}: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        logger.error(`Error al registrar Shipping Carrier para store_id ${storeId}:`);
        if (error.response) {
            logger.error(`  Status: ${error.response.status}`);
            logger.error(`  Headers: ${JSON.stringify(error.response.headers)}`);
            logger.error(`  Data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            logger.error(`  No response received. Request: ${error.request}`);
        } else {
            logger.error(`  Error message: ${error.message}`);
        }
        throw new Error(`No se pudo registrar el Shipping Carrier: ${error.response ? error.response.data.message || JSON.stringify(error.response.data) : error.message}`);
    }
};

/**
 * Crea una opción de envío (modalidad) para un Shipping Carrier existente.
 */
const createCarrierOption = async (storeId, accessToken, carrierId, optionData) => {
    const headers = {
        "Authentication": `bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": `TiendaNubeShippingApp/${process.env.TIENDA_NUBE_CLIENT_ID}`
    };
    const requestUrl = `${TIENDA_NUBE_API_BASE_URL}/${TIENDA_NUBE_API_VERSION}/${storeId}/shipping_carriers/${carrierId}/options`;

    logger.info(`[DEBUG] Creando Opción Carrier: URL -> ${requestUrl}`);
    logger.info(`[DEBUG] Creando Opción Carrier: Headers -> ${JSON.stringify(headers)}`);
    logger.info(`[DEBUG] Creando Opción Carrier: Payload -> ${JSON.stringify(optionData)}`);

    try {
        const response = await axios.post(
            requestUrl,
            optionData,
            { headers }
        );
        logger.info(`Opción de Carrier creada exitosamente para carrier ${carrierId}: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        logger.error(`Error al crear Opción de Carrier para carrier ${carrierId}:`);
        if (error.response) {
            logger.error(`  Status: ${error.response.status}`);
            logger.error(`  Headers: ${JSON.stringify(error.response.headers)}`);
            logger.error(`  Data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            logger.error(`  No response received. Request: ${error.request}`);
        } else {
            logger.error(`  Error message: ${error.message}`);
        }
        throw new Error(`No se pudo crear la opción de Carrier: ${error.response ? error.response.data.message || JSON.stringify(error.response.data) : error.message}`);
    }
};

module.exports = {
    registerShippingCarrier,
    createCarrierOption
};
