const express = require('express');
const router = express.Router();
const regulationController = require('../controllers/regulationController');

// Clean read-only routes for authoritative regulation information
router.get('/', regulationController.getRegulations);
router.get('/current', regulationController.getCurrentRegulation);
router.get('/:code', regulationController.getRegulationByCode);

module.exports = router;
