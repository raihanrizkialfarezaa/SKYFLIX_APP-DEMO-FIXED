// middlewares/filmValidation.js
const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const validateFilmAndUser = async (req, res, next) => {
    try {
        const db = getDB();
        const { title } = req.params;
        const decodedTitle = decodeURIComponent(title);

        // Get film data
        const film = await db.collection('films').findOne({
            title: { $regex: new RegExp(`^${decodedTitle}$`, 'i') }
        });

        if (!film) {
            return res.status(404).json({ message: 'Film not found' });
        }

        // No need to find user separately since we already have user data from auth middleware
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Attach both film and user data to request object
        req.film = film;
        req.user = user;
        next();
    } catch (error) {
        console.error('Film validation error:', error);
        res.status(500).json({ 
            message: 'Error validating film access',
            error: error.message 
        });
    }
};

module.exports = validateFilmAndUser;