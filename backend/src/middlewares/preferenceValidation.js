// middlewares/preferenceValidation.js
const { getDB } = require('../config/database');

const validatePreference = async (req, res, next) => {
    const { genreName, actorName, preferenceScore } = req.body;

    // Basic validation
    if (!genreName || !actorName || preferenceScore === undefined) {
        return res.status(400).json({
            message: 'Genre name, actor name, and preference score are required'
        });
    }

    if (preferenceScore < 0 || preferenceScore > 1) {
        return res.status(400).json({
            message: 'Preference score must be between 0 and 1'
        });
    }

    // Store validated data
    req.validatedPreference = {
        genreName,
        actorName: actorName.trim(),
        preferenceScore: parseFloat(preferenceScore)
    };

    next();
};

module.exports = validatePreference;