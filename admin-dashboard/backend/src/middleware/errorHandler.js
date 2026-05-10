export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  if (err.message === 'Invalid token' || err.message === 'No token provided') {
    return res.status(401).json({
      success: false,
      message: 'Authentication error',
      error: err.message,
    });
  }

  if (err.message.includes('Access denied')) {
    return res.status(403).json({
      success: false,
      message: 'Authorization error',
      error: err.message,
    });
  }

  if (err.message.includes('Not found')) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
      error: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};

export default errorHandler;
