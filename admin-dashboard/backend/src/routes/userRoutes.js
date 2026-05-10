import express from 'express';
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  banUser,
  unbanUser,
  changeUserRole,
  updateStorageLimit,
  deleteUser,
  loginAsUser,
} from '../controllers/userController.js';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.get('/email/:email', getUserByEmail);

router.patch('/:id/ban', banUser);
router.patch('/:id/unban', unbanUser);
router.patch('/:id/role', changeUserRole);
router.patch('/:id/storage', updateStorageLimit);
router.patch('/:id/login-as', loginAsUser);

router.delete('/:id', deleteUser);

export default router;
