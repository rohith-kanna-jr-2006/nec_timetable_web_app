const express = require('express');
const router = express.Router();
const academicContextController = require('../controllers/academicContextController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', academicContextController.getContexts);
router.get('/active', academicContextController.getActiveContext);
router.get('/:id', academicContextController.getContextById);
router.post('/', authenticateUser, requireRole('HOD', 'AC', 'ADMIN'), academicContextController.createContext);
router.put('/:id', authenticateUser, requireRole('HOD', 'AC', 'ADMIN'), academicContextController.updateContext);
router.delete('/:id', authenticateUser, requireRole('HOD', 'ADMIN'), academicContextController.deleteContext);

module.exports = router;
