export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  console.error(`[Error] ${err.message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    status,
    message: err.message || 'Internal Server Error',
  });
};