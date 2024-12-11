// middlewares/watchlistValidation.js
const { getDB } = require('../config/database');

const validateFilmTitle = async (req, res, next) => {
    try {
        const db = getDB();
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Film title is required' });
        }

        const film = await db.collection('films').findOne({
            title: { $regex: new RegExp(`^${title}$`, 'i') }
        });

        if (!film) {
            return res.status(404).json({ message: 'Film not found' });
        }

        // Attach film data to request
        req.film = film;
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = validateFilmTitle;