// src/routes/shippingRoutes.js V5.7
const express = require('express');
const router = express.Router();
const { getShippingRatesFromSheet } = require('../services/googleSheetsService');
const logger = require('../utils/logger');

// Middleware para validar el origen de la solicitud (opcional pero recomendado)
router.use((req, res, next) => {
    const userAgent = req.headers['user-agent'];
    if (!userAgent || !userAgent.includes('TiendaNubeAPI')) {
        logger.warn(`Solicitud a /api/shipping_rates de origen desconocido o User-Agent inesperado: ${userAgent}`);
    }
    next();
});

// Endpoint que Tienda Nube llamará para obtener las cotizaciones de envío
router.post('/shipping_rates', async (req, res) => {
    logger.info("Solicitud de cotización de envío recibida.");

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
        const optionsToProcess = data.carrier?.options || [];

        const sheetMap = {
            "ANDREANI A DOMICILIO": "ANDREANI DOM",
            "ANDREANI A SUCURSAL": "ANDREANI SUC",
            "CORREO ARGENTINO A DOMICILIO": "CA DOM",
            "CORREO ARGENTINO A SUCURSAL": "CA SUC",
            "OCA A DOMICILIO": "OCA DOM",
            "OCA A SUCURSAL": "OCA SUC",
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
                    // ========== FRAGMENTO MODIFICADO ==========
                    // Todas las opciones serán tipo 'ship' (envío a domicilio)
                    // La diferenciación será solo por el título/nombre del servicio
                    const finalType = 'ship';
                    // ========== FIN DE MODIFICACIÓN ==========
                    
                    const baseRate = {
                        "id": option.id,
                        "name": option.name, // Aquí se diferenciarán los servicios
                        "code": option.code,
                        "price": matchingRateInExcel.cost,
                        "price_merchant": matchingRateInExcel.cost,
                        "currency": "ARS",
                        "type": finalType, // Siempre será 'ship'
                        "min_delivery_date": new Date().toISOString(),
                        "max_delivery_date": new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
                        "phone_required": false,
                        "reference": "ref123"
                    };

                    // ========== FRAGMENTO MODIFICADO ==========
                    // ELIMINADO: No se agregan campos de pickup ya que todos son 'ship'
                    // ========== FIN DE MODIFICACIÓN ==========
                    
                    finalRates.push(baseRate);
                    logger.info(`Tarifa FINAL encontrada para la opción "${option.name}": ${JSON.stringify(finalRates[finalRates.length - 1])}`);
                } else {
                    logger.warn(`No se encontró una tarifa en el Excel para la opción de Tienda Nube: "${option.name}"`);
                }
            }
        }

        if (finalRates.length === 0) {
            logger.info(`No se encontraron tarifas válidas para CP ${postalCode}, peso ${totalWeightKg.toFixed(2)} kg.`);
        }

        const responsePayload = { rates: finalRates };
        logger.info(`Respondiendo con cotizaciones: ${JSON.stringify(responsePayload)}`);
        res.status(200).json(responsePayload);

    } catch (error) {
        logger.error(`Error al procesar la solicitud de cotización: ${error.message}`, error);
        res.status(200).json({ rates: [], error: "Error interno al calcular el envío." });
    }
});

module.exports = router;