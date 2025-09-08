// src/routes/authRoutes.js v3.0 (VARIANTE DOMICILIO)
const express = require('express');
const router = express.Router();
const oauthClient = require('../utils/oauthClient');
const tiendaNubeService = require('../services/tiendaNubeService');
const logger = require('../utils/logger');
const crypto = require('crypto');

router.get('/', (req, res) => {
    res.send("API Shipping Carrier DOMICILIO funcionando. Ir a /install para instalar en la tienda.");
});

router.get('/install', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauth_state = state;

    const tiendaNubeInstallUrl = `https://www.tiendanube.com/apps/${process.env.TIENDA_NUBE_CLIENT_ID}/authorize`;
    logger.info(`[DOMICILIO] Redirigiendo a instalación: ${tiendaNubeInstallUrl}`);
    res.redirect(tiendaNubeInstallUrl);
});

router.get('/oauth_callback', async (req, res) => {
    logger.info(`[DOMICILIO][DEBUG] Callback OAuth Query: ${JSON.stringify(req.query)}`);
    const { code, state, error, error_description } = req.query;

    if (error) {
        logger.error(`[DOMICILIO] Error OAuth: ${error} - ${error_description}`);
        return res.status(400).send(`Error de Tienda Nube: ${error_description || error}`);
    }

    if (state !== req.session.oauth_state) {
        logger.error("[DOMICILIO] Estado OAuth inválido.");
        return res.status(400).send("Error de seguridad: estado inválido.");
    }

    if (!code) {
        logger.error("[DOMICILIO] Falta code en callback.");
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
            logger.error(`[DOMICILIO] Respuesta token inválida: ${JSON.stringify(tokenData)}`);
            return res.status(500).send("Error al obtener token o ID de tienda.");
        }

        req.session.access_token = accessToken;
        req.session.store_id = storeId;
        logger.info(`[DOMICILIO] OAuth OK store_id=${storeId}`);

        logger.info("[DOMICILIO] Esperando 5s antes de registrar carrier...");
        await new Promise(r => setTimeout(r, 5000));

        const mainCarrierName = "Mobapp Domicilio";
        const mainCarrierInfo = await tiendaNubeService.registerShippingCarrier(
            storeId,
            accessToken,
            process.env.PUBLIC_API_URL,
            mainCarrierName
        );
        const mainCarrierId = mainCarrierInfo.id;
        logger.info(`[DOMICILIO] Carrier principal '${mainCarrierName}' ID=${mainCarrierId}`);

        // Solo opciones DOMICILIO
        const optionsToCreate = [
            { code: "ANDREANI_DOM", name: "ANDREANI A DOMICILIO", types: "ship" },
            { code: "CA_DOM", name: "CORREO ARGENTINO A DOMICILIO", types: "ship" },
            { code: "OCA_DOM", name: "OCA A DOMICILIO", types: "ship" },
            { code: "URBANO_DOM", name: "URBANO A DOMICILIO", types: "ship" },
            { code: "ANDREANI_BIGGER_DOM", name: "ANDREANI BIGGER A DOM", types: "ship" },
        ];

        for (const option of optionsToCreate) {
            try {
                await tiendaNubeService.createCarrierOption(
                    storeId,
                    accessToken,
                    mainCarrierId,
                    {
                        code: option.code,
                        name: option.name,
                        types: option.types,
                        additional_days: 0,
                        additional_cost: 0,
                        allow_free_shipping: true,
                        active: true
                    }
                );
                logger.info(`[DOMICILIO] Opción '${option.name}' creada.`);
            } catch (e) {
                logger.error(`[DOMICILIO] Error creando opción '${option.name}': ${e.message}`);
            }
        }

        res.status(200).send(`
            <h1>Carrier '${mainCarrierName}' instalado (DOMICILIO)</h1>
            <p>Opciones creadas: ${optionsToCreate.map(o => o.name).join(', ')}</p>
            <p>Endpoint tarifas: ${process.env.PUBLIC_API_URL}/api/shipping_rates</p>
            <p>Probar en checkout.</p>
        `);
    } catch (err) {
        logger.error(`[DOMICILIO] Error instalación: ${err.message}`, err);
        res.status(500).send(`Error durante la instalación: ${err.message}`);
    }
});

module.exports = router;
