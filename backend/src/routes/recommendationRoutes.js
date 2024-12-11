const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

router.get('/personalized', auth, recommendationController.getPersonalizedRecommendations);
router.get('/trending', recommendationController.getTrendingContent);
router.get('/similar/:filmId', recommendationController.getSimilarContent);
router.get('/genre/:genreId', auth, recommendationController.getGenreRecommendations);

// Admin routes
router.post('/trending/refresh', [auth, adminAuth], recommendationController.refreshTrendingCache);

module.exports = router;