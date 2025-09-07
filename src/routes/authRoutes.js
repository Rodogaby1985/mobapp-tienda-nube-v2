// src/routes/authRoutes.js v3.0
const express = require('express');
const router = express.Router();
const oauthClient = require('../utils/oauthClient');
const tiendaNubeService = require('../services/tiendaNubeService');
const logger = require('../utils/logger');
const crypto = require('crypto');

router.get('/', (req, res) => {
    res.send("Tu API de Shipping Carrier de Tienda Nube está funcionando. Accede a /install para comenzar la configuración.");
});

router.get('/install', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauth_state = state;

    const tiendaNubeInstallUrl = `https://www.tiendanube.com/apps/${process.env.TIENDA_NUBE_CLIENT_ID}/authorize`;
    
    logger.info(`Redirigiendo a URL de instalación de Tienda Nube: ${tiendaNubeInstallUrl}`);
    res.redirect(tiendaNubeInstallUrl);
});

router.get('/oauth_callback', async (req, res) => {
    logger.info(`[DEBUG] Solicitud recibida en /oauth_callback. Query: ${JSON.stringify(req.query)}`);
    const { code, state, error, error_description } = req.query;

    if (error) {
        logger.error(`Error en callback de OAuth: ${error} - ${error_description}`);
        return res.status(400).send(`Error de Tienda Nube: ${error_description || error}`);
    }

    if (state !== req.session.oauth_state) {
        logger.error("Error de estado OAuth: Discrepancia.");
        return res.status(400).send("Error de seguridad: estado inválido.");
    }

    if (!code) {
        logger.error("Código de autorización no recibido en el callback.");
        return res.status(400).send("Falta el código de autorización.");
    }

    try {
        const tokenData = await oauthClient.exchangeCodeForToken(
            process.env.TIENDA_NUBE_CLIENT_ID,
            process.env.TIENDA_NUBE_CLIENT_SECRET,
            code,
            process.env.PUBLIC_API_URL
        );

        const accessToken = tokenData.access_token;
        const storeId = tokenData.user_id; 

        if (!accessToken || !storeId) {
            logger.error(`No se recibió access_token o store_id en la respuesta del token: ${JSON.stringify(tokenData)}`);
            return res.status(500).send("Error al obtener token o ID de tienda.");
        }

        req.session.access_token = accessToken;
        req.session.store_id = storeId;
        
        logger.info(`OAuth exitoso para store_id: ${storeId}. Access Token obtenido.`);

        logger.info("Esperando 5 segundos antes de registrar el Shipping Carrier principal...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // --- Lógica para registrar UN ÚNICO transportista principal ---
        const mainCarrierName = "Mobapp Express";
        const mainCarrierInfo = await tiendaNubeService.registerShippingCarrier(
            storeId,
            accessToken,
            process.env.PUBLIC_API_URL,
            mainCarrierName
        );
        const mainCarrierId = mainCarrierInfo.id;
        logger.info(`Transportista principal '${mainCarrierName}' registrado con ID: ${mainCarrierId}`);

        // --- Lógica para crear las múltiples opciones de envío bajo ese transportista ---
        const optionsToCreate = [
            { code: "ANDREANI_DOM", name: "ANDREANI A DOMICILIO", types: "ship" },
            { code: "ANDREANI_SUC", name: "ANDREANI A SUCURSAL", types: "pickup" },
            { code: "CA_DOM", name: "CORREO ARGENTINO A DOMICILIO", types: "ship" },
            { code: "CA_SUC", name: "CORREO ARGENTINO A SUCURSAL", types: "pickup" },
            { code: "OCA_DOM", name: "OCA A DOMICILIO", types: "ship" },
            { code: "OCA_SUC", name: "OCA A SUCURSAL", types: "pickup" },
            { code: "URBANO_DOM", name: "URBANO A DOMICILIO", types: "ship" },
            { code: "ANDREANI_BIGGER_DOM", name: "ANDREANI BIGGER A DOM", types: "ship" },
        ];

        for (const option of optionsToCreate) {
            try {
                await tiendaNubeService.createCarrierOption(storeId, accessToken, mainCarrierId, {
                    code: option.code,
                    name: option.name,
                    types: option.types,
                    additional_days: 0,
                    additional_cost: 0,
                    allow_free_shipping: true,
                    active: true
                });
                logger.info(`Opción de Carrier '${option.name}' creada exitosamente bajo el ID de carrier principal: ${mainCarrierId}`);
            } catch (optionError) {
                logger.error(`Error al crear la opción '${option.name}': ${optionError.message}`);
            }
        }
        // --- Fin de la lógica para opciones de envío ---

        res.status(200).send(`
            <h1>¡El Shipping Carrier '${mainCarrierName}' ha sido registrado exitosamente en Tienda Nube!</h1>
            <p>Se crearon las siguientes modalidades: ${optionsToCreate.map(opt => opt.name).join(', ')}</p>
            <p>Ahora Tienda Nube consultará esta URL para las tarifas: ${process.env.PUBLIC_API_URL}/api/shipping_rates</p>
            <p><strong>Ve al checkout de tu tienda para probarlo.</strong></p>
        `);
    } catch (error) {
        logger.error(`Error en el proceso de OAuth o registro del carrier: ${error.message}`, error);
        res.status(500).send(`Error durante la instalación de la aplicación: ${error.message}`);
    }
});

module.exports = router;
