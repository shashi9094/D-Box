import express from 'express';
import { getActivityLogs, getUserActivityLogs } from '../controllers/activityController.js';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get('/', getActivityLogs);
router.get('/user/:userId', getUserActivityLogs);

export default router;
