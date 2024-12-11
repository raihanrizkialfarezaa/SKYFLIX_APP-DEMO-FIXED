const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

async function adminAuth(req, res, next) {
  try {
    const db = getDB();
    const userId = new ObjectId(req.user._id);

    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { role: 1, username: 1 } }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only administrators can upload films.',
        currentRole: user.role,
        requiredRole: 'admin'
      });
    }

    // Add admin info to request for logging purposes
    req.admin = {
      id: user._id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error checking admin authorization',
      error: error.message 
    });
  }
}

module.exports = adminAuth;