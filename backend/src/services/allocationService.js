const ClassAdvisorAssignment = require('../models/ClassAdvisorAssignment');
const HODFacultyAllocation = require('../models/HODFacultyAllocation');

/**
 * Ensures no duplicate active class advisor assignment exists for the academic context.
 */
async function assignClassAdvisor({ academicContextId, facultyId, assignedBy }) {
  // Deactivate any existing active advisor for this context
  await ClassAdvisorAssignment.updateMany(
    { academicContextId, status: 'ACTIVE' },
    { status: 'INACTIVE' }
  );

  const newAssignment = await ClassAdvisorAssignment.create({
    academicContextId,
    facultyId,
    assignedBy,
    assignedAt: new Date(),
    status: 'ACTIVE',
  });

  return newAssignment;
}

/**
 * Validates and updates HOD Allocation status.
 * Business Rule: AC cannot approve. Only HOD/ADMIN can transition to APPROVED.
 */
async function updateAllocationStatus(allocationId, newStatus, userRole, rejectionReason = null) {
  if (newStatus === 'APPROVED' && !['HOD', 'ADMIN'].includes(userRole)) {
    throw new Error('Only HOD has the authority to approve faculty allocations.');
  }

  const allocation = await HODFacultyAllocation.findById(allocationId);
  if (!allocation) {
    throw new Error('Faculty allocation record not found.');
  }

  allocation.status = newStatus;
  if (newStatus === 'REJECTED') {
    allocation.rejectionReason = rejectionReason || 'Rejected by HOD';
  } else if (newStatus === 'APPROVED') {
    allocation.rejectionReason = null;
  }

  await allocation.save();
  return allocation;
}

module.exports = {
  assignClassAdvisor,
  updateAllocationStatus,
};
