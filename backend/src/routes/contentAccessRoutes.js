const express = require('express');
const router = express.Router();
const contentAccessController = require('../controllers/contentAccessController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

router.get('/check/:title', auth, contentAccessController.checkAccess);
router.get('/history', auth, contentAccessController.getViewingHistory);
router.get('/analytics', auth, contentAccessController.getAccessAnalytics);

// New admin-only CRUD routes
router.post('/create', [auth, adminAuth], contentAccessController.createContentAccess);
router.get('/all', [auth, adminAuth], contentAccessController.getAllContentAccess);
router.put('/:id', [auth, adminAuth], contentAccessController.updateContentAccess);
router.delete('/:id', [auth, adminAuth], contentAccessController.deleteContentAccess);
router.get('/pending-films', [auth, adminAuth], contentAccessController.getFilmsWithoutAccess);

module.exports = router;