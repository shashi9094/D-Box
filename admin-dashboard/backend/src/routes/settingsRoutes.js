import express from 'express';
import { getSettings, updateSettings, getSetting } from '../controllers/settingsController.js';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get('/', getSettings);
router.get('/:key', getSetting);
router.patch('/', updateSettings);

export default router;
