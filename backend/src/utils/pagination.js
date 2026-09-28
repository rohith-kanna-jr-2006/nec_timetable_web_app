/**
 * Helper to parse pagination parameters from query
 */
function getPaginationParams(query = {}, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Format paginated result structure
 */
function formatPaginatedResult(items, totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit) || 1;
  return {
    items,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = {
  getPaginationParams,
  formatPaginatedResult,
};
