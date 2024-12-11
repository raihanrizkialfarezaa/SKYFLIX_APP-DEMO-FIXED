const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const authController = {
  // Register new user
  async register(req, res) {
    try {
      const db = getDB();
      const { 
        username, 
        email, 
        password, 
        fullName, 
        dateOfBirth, 
        country
      } = req.body;

      // Check if user exists
      const existingUser = await db.collection('users').findOne({ 
        $or: [{ email }, { username }] 
      });

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user with default free account
      const user = {
        username,
        email,
        password: hashedPassword,
        fullName,
        dateOfBirth: new Date(dateOfBirth),
        country,
        accountType: 'free', // Always set to free by default
        createdAt: new Date(),
        preferences: [],
        subscription: null, // No subscription by default
        role: 'user'
      };

      const result = await db.collection('users').insertOne(user);
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: result.insertedId }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          _id: result.insertedId,
          username,
          email,
          fullName,
          country,
          accountType: 'free'
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Login user
  async login(req, res) {
    try {
      const db = getDB();
      const { username, password } = req.body;

      // Find user
      const user = await db.collection('users').findOne({ username });

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check subscription status if premium account
      if (user.accountType === 'premium' && user.subscription) {
        const now = new Date();
        const endDate = new Date(user.subscription.endDate);
        const gracePeriodEnd = new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000));

        if (now > gracePeriodEnd) {
          await db.collection('users').updateOne(
            { _id: user._id },
            { 
              $set: { 
                accountType: 'free',
                'subscription.status': 'expired'
              }
            }
          );
          user.accountType = 'free';
        }
      }

      // Generate token
      const token = jwt.sign(
        { userId: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          subscription: user.subscription,
          accountType: user.accountType
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = authController;