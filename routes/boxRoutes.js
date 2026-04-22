const express = require('express');
const router = express.Router();
const boxController = require('../controllers/boxController');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

//Create Box
router.post('/create', boxController.createBox);

//Get All Boxes
router.get('/list', boxController.getAllBoxes);

//Update Box
router.put('/update/:id', boxController.updateBox);

//Delete Box
router.delete('/delete/:id', boxController.deleteBox);

router.get('/my-boxes', boxController.getMyBoxes);
router.get('/other-boxes', boxController.getOtherUsersBoxes);

// Group member management
router.get('/:boxId/members', boxController.listMembers);
router.post('/:boxId/members', boxController.addMemberByEmail);
router.patch('/:boxId/members/:memberUserId/role', boxController.promoteMember);
router.delete('/:boxId/members/:memberUserId/role', boxController.demoteMember);
router.delete('/:boxId/members/:memberUserId', boxController.removeMember);

// Box content management
router.get('/:boxId/content', boxController.getBoxContents);
router.post('/:boxId/content', boxController.uploadBoxContent);
router.patch('/:boxId/content/:contentId', boxController.renameBoxContent);
router.patch('/:boxId/content/:contentId/admin-note', boxController.updateContentAdminNote);
router.delete('/:boxId/content/:contentId', boxController.deleteBoxContent);

//Get Single Box
router.get('/:id', boxController.getBoxById);

module.exports = router;
