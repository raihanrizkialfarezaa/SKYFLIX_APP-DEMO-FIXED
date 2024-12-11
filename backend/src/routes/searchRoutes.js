const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const auth = require('../middlewares/auth');

router.get('/', auth, searchController.searchContent);
router.get('/filters', auth, searchController.getFilters);
router.get('/suggestions', auth, searchController.getSuggestions);

module.exports = router;