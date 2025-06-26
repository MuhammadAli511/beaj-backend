// Middleware to generate unique request IDs for error tracking
const requestIdMiddleware = (req, res, next) => {
    // Generate a unique request ID
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add the request ID to response headers for easier debugging
    res.setHeader('X-Request-ID', req.requestId);

    next();
};

export default requestIdMiddleware; 