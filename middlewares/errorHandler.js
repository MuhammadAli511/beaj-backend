import {
    getUserMobileNumberForRequest,
    getProfileIdForRequest,
    getBotPhoneNumberIdForRequest
} from '../utils/requestContext.js';

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const timestamp = new Date().toISOString();

    // Extract file and line number from stack trace
    let fileName = err.fileName || 'Unknown File';
    let lineNumber = 'Unknown Line';
    let functionName = 'Unknown Function';

    if (err.stack) {
        const stackLines = err.stack.split('\n');
        // Look for the first line that contains a file path (usually the second line)
        for (let i = 1; i < stackLines.length; i++) {
            const line = stackLines[i];
            if (line.includes('.js:')) {
                // Handle different stack trace formats:
                // Format 1: at functionName (file:///path/to/file.js:line:column)
                // Format 2: at file:///path/to/file.js:line:column

                let match = line.match(/at\s+(.+?)\s+\(.*[\/\\]([^\/\\]+\.js):(\d+):(\d+)\)/);
                if (match) {
                    functionName = match[1];
                    fileName = match[2];
                    lineNumber = match[3];
                    break;
                }

                // Try second format (no function name)
                match = line.match(/at\s+.*[\/\\]([^\/\\]+\.js):(\d+):(\d+)/);
                if (match) {
                    functionName = 'anonymous';
                    fileName = match[1];
                    lineNumber = match[2];
                    break;
                }

                // Fallback: try to extract just filename and line number
                match = line.match(/([^\/\\]+\.js):(\d+):(\d+)/);
                if (match) {
                    fileName = match[1];
                    lineNumber = match[2];
                    functionName = 'unknown';
                    break;
                }
            }
        }
    }

    // Get user context information from AsyncLocalStorage
    let userMobileNumber = getUserMobileNumberForRequest();
    let profileId = getProfileIdForRequest();
    let botPhoneNumberId = getBotPhoneNumberIdForRequest();

    // If context is not available from AsyncLocalStorage, try to extract from request body (for webhook)
    if (!userMobileNumber && req.body?.entry?.[0]?.changes?.[0]?.value) {
        const webhookData = req.body.entry[0].changes[0].value;

        // Extract from webhook message data
        if (webhookData.messages?.[0]?.from) {
            userMobileNumber = "+" + webhookData.messages[0].from;
        }

        // Extract bot phone number ID from metadata
        if (webhookData.metadata?.phone_number_id) {
            botPhoneNumberId = webhookData.metadata.phone_number_id;
        }

        // Note: profileId would need to be looked up from database if needed
    }

    // Generate unique request ID for tracking
    const requestId = req.requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build comprehensive error details
    const errorDetails = {
        // Basic error info
        message: err.message,
        statusCode,
        timestamp,
        requestId,

        // File and location info
        fileName,
        lineNumber,
        functionName,

        // User context (WhatsApp bot context)
        userMobileNumber: userMobileNumber || null,
        profileId: profileId || null,
        botPhoneNumberId: botPhoneNumberId || null,

        // Request info
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,

        // Auth info (for internal API users)
        userEmail: req.email || null,

        // Additional context
        body: req.method !== 'GET' ? req.body : undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        params: Object.keys(req.params).length > 0 ? req.params : undefined
    };

    // Log detailed error for internal debugging
    console.error('=== ERROR DETAILS ===');
    console.error(JSON.stringify(errorDetails, null, 2));
    console.error('=== STACK TRACE ===');
    console.error(err.stack);
    console.error('=====================');

    // Check if response has already been sent (common with webhooks)
    if (res.headersSent) {
        console.error('⚠️  Response already sent - cannot send error response to client');
        return;
    }

    // Send error response
    res.status(statusCode).json(errorDetails);
};

export default errorHandler;