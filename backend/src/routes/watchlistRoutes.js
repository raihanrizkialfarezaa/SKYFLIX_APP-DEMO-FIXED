const express = require('express');
const router = express.Router();
const watchlistController = require('../controllers/watchlistController');
const auth = require('../middlewares/auth');
const validateFilmTitle = require('../middlewares/watchlistValidation');

router.post('/add', auth, validateFilmTitle, watchlistController.addToWatchlist);
router.get('/', auth, watchlistController.getWatchlist);
router.delete('/:filmId', auth, watchlistController.removeFromWatchlist);

module.exports = router;