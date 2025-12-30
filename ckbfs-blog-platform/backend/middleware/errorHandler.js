/**
 * Global error handling middleware
 * Provides consistent error responses across all endpoints
 */
export function errorHandler(err, req, res, next) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
  
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
  
  /**
   * 404 handler for undefined routes
   */
  export function notFoundHandler(req, res) {
    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
        statusCode: 404,
        path: req.path,
      },
    });
  }
  
  /**
   * Custom error class for application-specific errors
   */
  export class AppError extends Error {
    constructor(message, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'AppError';
    }
  }