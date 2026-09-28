const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', availabilityController.getAvailability);
router.post('/', authenticateUser, availabilityController.setAvailability);
router.delete('/:id', authenticateUser, availabilityController.deleteAvailability);

module.exports = router;
