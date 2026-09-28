const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { validateLogin, validateRegister } = require('../validators/authValidators');

router.post('/login', validate(validateLogin), authController.login);
router.post('/register', validate(validateRegister), authController.register);
router.get('/me', authenticateUser, authController.getMe);

module.exports = router;
