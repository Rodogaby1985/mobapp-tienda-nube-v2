// src/utils/oauthClient.js v1.0
const axios = require('axios');
const { TIENDA_NUBE_AUTH_URL, TIENDA_NUBE_TOKEN_URL } = require('./constants');
const logger = require('./logger');

/**
 * Genera la URL de autorización de Tienda Nube para iniciar el flujo OAuth.
 * @param {string} clientId - El Client ID de tu aplicación de Tienda Nube.
 * @param {string} publicApiUrl - La URL pública base de tu aplicación (ej. la URL de ngrok).
 * @param {string} state - Un valor aleatorio para protección CSRF.
 * @returns {string} La URL completa de autorización de Tienda Nube.
 */
const getAuthorizationUrl = (clientId, publicApiUrl, state) => {
    // La 'redirect_uri' debe coincidir exactamente con la configurada en el panel de desarrolladores de Tienda Nube.
    const redirectUri = `${publicApiUrl}/oauth_callback`;
    
    // Define los scopes (permisos) que tu aplicación necesita.
    // Estos deben coincidir con los permisos marcados en el panel de desarrolladores de Tienda Nube.
    const scopes = ["read_products", "write_products", "read_orders", "read_shipping", "edit_shipping", "read_logistics", "write_logistics"]; 
    
    // Construye los parámetros de la URL de autorización.
    const params = new URLSearchParams({
        client_id: clientId,
        scope: scopes.join(' '), // Los scopes se unen con espacios
        redirect_uri: redirectUri,
        response_type: 'code', // Siempre 'code' para el flujo de código de autorización
        state: state // Parámetro de seguridad para prevenir CSRF
    }).toString();

    const authUrl = `${TIENDA_NUBE_AUTH_URL}?${params}`;
    logger.info(`URL de autorización generada: ${authUrl}`);
    return authUrl;
};

/**
 * Intercambia el código de autorización por un token de acceso y el ID de la tienda.
 * @param {string} clientId - El Client ID de tu aplicación de Tienda Nube.
 * @param {string} clientSecret - El Client Secret de tu aplicación de Tienda Nube.
 * @param {string} code - El código de autorización recibido de Tienda Nube.
 * @param {string} publicApiUrl - La URL pública base de tu aplicación (ej. la URL de ngrok).
 * @returns {Promise<object>} Una promesa que resuelve con los datos del token (access_token, store_id, etc.).
 * @throws {Error} Si falla la solicitud o la respuesta no es la esperada.
 */
const exchangeCodeForToken = async (clientId, clientSecret, code, publicApiUrl) => {
    // La 'redirect_uri' aquí también debe coincidir con la usada en el paso de autorización.
    const redirectUri = `${publicApiUrl}/oauth_callback`;
    
    // Prepara los parámetros para la solicitud POST al endpoint de token de Tienda Nube.
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code', // Tipo de grant para el flujo de código de autorización
        code: code, // El código de autorización recibido
        redirect_uri: redirectUri // La URL de redirección
    });

    // --- NUEVOS LOGS DE DEPURACIÓN (para diagnosticar el 404) ---
    logger.info(`[DEBUG] Intercambio de Token: URL -> ${TIENDA_NUBE_TOKEN_URL}`);
    logger.info(`[DEBUG] Intercambio de Token: Payload -> ${params.toString()}`);
    logger.info(`[DEBUG] Intercambio de Token: Headers -> Content-Type: application/x-www-form-urlencoded`);
    // --- FIN NUEVOS LOGS ---

    try {
        // Realiza la solicitud POST al endpoint de token de Tienda Nube.
        const response = await axios.post(TIENDA_NUBE_TOKEN_URL, params.toString(), {
            headers: {
                // Es crucial que el Content-Type sea 'application/x-www-form-urlencoded'
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        logger.info(`Token response received: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error) {
        // Loguear la respuesta de error completa si está disponible para un mejor diagnóstico.
        logger.error(`Error al intercambiar código por token: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        // Lanzar un error para que sea capturado por el try/catch superior.
        throw new Error(`Fallo al obtener el token de acceso: ${error.response ? error.response.data.message || JSON.stringify(error.response.data) : error.message}`);
    }
};

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForToken
};
