const express = require('express');
const router = express.Router();
const tcProposalController = require('../controllers/tcProposalController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// TC Proposal routes
router.post(
  '/',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  tcProposalController.saveProposal
);

router.put(
  '/context/:academicContextId/course/:courseCode',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  tcProposalController.saveProposal
);

router.get(
  '/context/:academicContextId',
  authenticateUser,
  requireRole('TC', 'AC', 'HOD', 'ADMIN'),
  tcProposalController.getProposalsByContext
);

router.get(
  '/:id',
  authenticateUser,
  requireRole('TC', 'AC', 'HOD', 'ADMIN'),
  tcProposalController.getProposalById
);

// Submit proposal: TC / ADMIN only
router.patch(
  '/:id/submit',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  tcProposalController.submitProposal
);
router.post(
  '/:id/submit',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  tcProposalController.submitProposal
);

// Approve proposal: HOD / ADMIN only (TC blocked with 403)
router.patch(
  '/:id/approve',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  tcProposalController.approveProposal
);
router.post(
  '/:id/approve',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  tcProposalController.approveProposal
);

// Reject proposal: HOD / ADMIN only (TC blocked with 403)
router.patch(
  '/:id/reject',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  tcProposalController.rejectProposal
);
router.post(
  '/:id/reject',
  authenticateUser,
  requireRole('HOD', 'ADMIN'),
  tcProposalController.rejectProposal
);

// Delete proposal: TC / ADMIN only
router.delete(
  '/:id',
  authenticateUser,
  requireRole('TC', 'AC', 'ADMIN'),
  tcProposalController.deleteProposal
);

module.exports = router;
