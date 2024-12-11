const express = require('express');
const router = express.Router();
const filmController = require('../controllers/filmController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const upload = require('../middlewares/upload');
const validateFilmAndUser = require('../middlewares/filmValidation');

router.post('/upload', [auth, adminAuth], upload.single('video'), filmController.uploadFilm);
router.get('/', filmController.getFilms);
router.get('/title/:title', filmController.getFilmByTitle);
// User authenticated routes
router.post('/view/:title', [auth, validateFilmAndUser], filmController.updateViewCount);

module.exports = router;