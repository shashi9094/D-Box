import express from 'express';
import { getAllFiles, getUserFiles, deleteFile } from '../controllers/fileController.js';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get('/', getAllFiles);
router.get('/user/:userId', getUserFiles);
router.delete('/:fileId', deleteFile);

export default router;
