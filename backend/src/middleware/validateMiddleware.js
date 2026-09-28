const { errorResponse } = require('../utils/responseHandler');

/**
 * Higher-order middleware to run a validation function on req.body/params/query.
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req);
    if (errors && errors.length > 0) {
      return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors);
    }
    next();
  };
}

module.exports = {
  validate,
};
