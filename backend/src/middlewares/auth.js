const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

async function auth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
}

module.exports = auth;