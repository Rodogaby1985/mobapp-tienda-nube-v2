// src/routes/shippingRoutes.js V5.7 (DOMICILIO ONLY - reducción mínima)
const express = require('express');
const router = express.Router();
const { getShippingRatesFromSheet } = require('../services/googleSheetsService');
const logger = require('../utils/logger');

router.use((req, res, next) => {
    const userAgent = req.headers['user-agent'];
    if (!userAgent || !userAgent.includes('TiendaNubeAPI')) {
        logger.warn(`Solicitud a /api/shipping_rates de origen desconocido o User-Agent inesperado: ${userAgent}`);
    }
    next();
});

router.post('/shipping_rates', async (req, res) => {
    logger.info("Solicitud de cotización de envío recibida (modalidad DOMICILIO).");

    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
        logger.error("No se recibieron datos en la solicitud de cotización.");
        return res.status(200).json({ rates: [] });
    }

    logger.info(`Datos recibidos para cotización: ${JSON.stringify(data, null, 2)}`);

    const postalCode = data.destination?.zipcode || data.destination?.postal_code || data.origin?.postal_code;
    const items = data.items || [];

    let totalWeightKg = 0;
    for (const item of items) {
        totalWeightKg += (item.grams / 1000) * item.quantity;
    }

    logger.info(`Calculando envío para CP: ${postalCode}, Peso Total: ${totalWeightKg.toFixed(2)} kg`);

    if (!postalCode) {
        logger.warn("Código postal no proporcionado en la solicitud de envío.");
        return res.status(200).json({ rates: [] });
    }

    try {
        const finalRates = [];
        const allOptions = data.carrier?.options || [];

        // Excluir cualquier opción SUCURSAL por si llega mezclada
        const optionsToProcess = allOptions.filter(o =>
            typeof o.name === 'string' && !o.name.toUpperCase().includes('SUCURSAL')
        );

        const sheetMap = {
            "ANDREANI A DOMICILIO": "ANDREANI DOM",
            "CORREO ARGENTINO A DOMICILIO": "CA DOM",
            "OCA A DOMICILIO": "OCA DOM",
            "URBANO A DOMICILIO": "URBANO",
            "ANDREANI BIGGER A DOM": "ANDREANI BIGGER A DOM",
        };

        for (const option of optionsToProcess) {
            const sheetName = sheetMap[option.name];
            if (sheetName) {
                const ratesForSheet = await getShippingRatesFromSheet(sheetName, totalWeightKg, postalCode);

                const matchingRateInExcel = ratesForSheet.find(rate => {
                    const rateNameFromExcel = rate.name.trim().toUpperCase();
                    const optionNameFromTiendanube = option.name.trim().toUpperCase();
                    return rateNameFromExcel === optionNameFromTiendanube;
                });

                if (matchingRateInExcel) {
                    const finalType = 'ship';

                    const baseRate = {
                        id: option.id,
                        name: option.name,
                        code: option.code,
                        price: matchingRateInExcel.cost,
                        price_merchant: matchingRateInExcel.cost,
                        currency: "ARS",
                        type: finalType,
                        min_delivery_date: new Date().toISOString(),
                        max_delivery_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
                        phone_required: false,
                        reference: "ref123"
                    };

                    finalRates.push(baseRate);
                    logger.info(`Tarifa FINAL (DOMICILIO) "${option.name}": ${JSON.stringify(baseRate)}`);
                } else {
                    logger.warn(`No se encontró tarifa en el Excel para la opción DOMICILIO: "${option.name}"`);
                }
            }
        }

        if (finalRates.length === 0) {
            logger.info(`Sin tarifas válidas DOMICILIO para CP ${postalCode}, peso ${totalWeightKg.toFixed(2)} kg.`);
        }

        const responsePayload = { rates: finalRates };
        logger.info(`Respuesta DOMICILIO: ${JSON.stringify(responsePayload)}`);
        res.status(200).json(responsePayload);

    } catch (error) {
        logger.error(`Error al procesar la solicitud de cotización DOMICILIO: ${error.message}`, error);
        res.status(200).json({ rates: [], error: "Error interno al calcular el envío." });
    }
});

module.exports = router;
