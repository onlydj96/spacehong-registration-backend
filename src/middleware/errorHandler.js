export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  if (err.code && err.message) {
    return res.status(500).json({
      success: false,
      errors: ['데이터베이스 오류가 발생했습니다.'],
    });
  }

  res.status(500).json({
    success: false,
    errors: ['서버 오류가 발생했습니다.'],
  });
}
