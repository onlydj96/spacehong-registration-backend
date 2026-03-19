// Error types and messages
const ERROR_TYPES = {
  ENTITY_TOO_LARGE: 'entity.too.large',
  VALIDATION_ERROR: 'ValidationError',
  UNAUTHORIZED: 'UnauthorizedError',
};

const ERROR_MESSAGES = {
  ENTITY_TOO_LARGE: '요청 데이터가 너무 큽니다.',
  DATABASE_ERROR: '데이터베이스 오류가 발생했습니다.',
  VALIDATION_ERROR: '입력값이 올바르지 않습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
};

// HTTP status codes
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ENTITY_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Log error with timestamp and request info
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [Error] ${err.name || 'Error'}: ${err.message}`;

  if (isDev) {
    console.error(logMessage);
    console.error('[Stack]', err.stack);
  } else {
    // In production, log minimal info
    console.error(logMessage);
  }

  // Handle specific error types
  if (err.type === ERROR_TYPES.ENTITY_TOO_LARGE) {
    return res.status(HTTP_STATUS.ENTITY_TOO_LARGE).json({
      success: false,
      errors: [ERROR_MESSAGES.ENTITY_TOO_LARGE],
    });
  }

  // Handle validation errors
  if (err.name === ERROR_TYPES.VALIDATION_ERROR) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      errors: [err.message || ERROR_MESSAGES.VALIDATION_ERROR],
    });
  }

  // Handle authentication errors
  if (err.name === ERROR_TYPES.UNAUTHORIZED || err.status === HTTP_STATUS.UNAUTHORIZED) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      errors: [ERROR_MESSAGES.UNAUTHORIZED],
    });
  }

  // Handle Supabase/database errors
  if (err.code && err.message) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      errors: [ERROR_MESSAGES.DATABASE_ERROR],
    });
  }

  // Default server error
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    errors: [ERROR_MESSAGES.SERVER_ERROR],
  });
}
