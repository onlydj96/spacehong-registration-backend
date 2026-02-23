export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.error('[Error]', err.message);
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      errors: ['요청 데이터가 너무 큽니다.'],
    });
  }

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
