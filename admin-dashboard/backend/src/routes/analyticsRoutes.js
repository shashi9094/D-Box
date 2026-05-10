import express from 'express';
import { getStats, getDashboardMetrics } from '../controllers/analyticsController.js';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get('/stats', getStats);
router.get('/metrics', getDashboardMetrics);

export default router;
