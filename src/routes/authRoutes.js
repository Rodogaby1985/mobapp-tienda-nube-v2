// src/routes/authRoutes.js v3.0 (VARIANTE DOMICILIO)
const express = require('express');
const router = express.Router();
const oauthClient = require('../utils/oauthClient');
const tiendaNubeService = require('../services/tiendaNubeService');
const crypto = require('crypto');

router.get('/install', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth_state = state;
  const url = `https://www.tiendanube.com/apps/${process.env.TIENDA_NUBE_CLIENT_ID}/authorize`;
  res.redirect(url);
});

router.get('/oauth_callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauth_state) return res.status(400).send("Estado inválido");
  const tokenData = await oauthClient.exchangeCodeForToken(
    process.env.TIENDA_NUBE_CLIENT_ID,
    process.env.TIENDA_NUBE_CLIENT_SECRET,
    code,
    process.env.PUBLIC_API_URL
  );
  const accessToken = tokenData.access_token;
  const storeId = tokenData.user_id;

  const carrierName = "Mobapp Domicilio";
  const carrierInfo = await tiendaNubeService.registerShippingCarrier(
    storeId,
    accessToken,
    process.env.PUBLIC_API_URL,
    carrierName
  );
  const carrierId = carrierInfo.id;

  const options = [
    { code: "ANDREANI_DOM", name: "ANDREANI A DOMICILIO" },
    { code: "CA_DOM", name: "CORREO ARGENTINO A DOMICILIO" },
    { code: "OCA_DOM", name: "OCA A DOMICILIO" },
    { code: "URBANO_DOM", name: "URBANO A DOMICILIO" },
    { code: "ANDREANI_BIGGER_DOM", name: "ANDREANI BIGGER A DOM" }
  ];

  for (const opt of options) {
    await tiendaNubeService.createCarrierOption(storeId, accessToken, carrierId, {
      code: opt.code,
      name: opt.name,
      types: 'ship',
      additional_days: 0,
      additional_cost: 0,
      allow_free_shipping: true,
      active: true
    });
  }

  res.send("Instalado DOMICILIO.");
});

module.exports = router;

