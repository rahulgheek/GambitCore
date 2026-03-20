// Inside middleware/auth.js
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    // 1. Look for the token in the user's cookies
    const token = req.cookies.token;

    // 2. If there is no token, kick them back to the home page (or a login page)
    if (!token) {
        return res.status(401).json({ status: 'error', message: 'Access Denied. Please log in.' });
        // Alternatively, if this was purely a web app, you'd do: res.redirect('/');
    }

    try {
        // 3. Verify the token using your secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. Attach the decoded user data to the request object so the next route can use it
        req.user = decoded; 
        
        // 5. Pass control to the actual route handler
        next(); 
    } catch (error) {
        return res.status(403).json({ status: 'error', message: 'Invalid or expired token.' });
    }
}

module.exports = requireAuth;