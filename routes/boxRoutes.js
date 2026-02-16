const express = require('express');
const router = express.Router();
const boxController = require('../controllers/boxController');

//Create Box
router.post('/create', boxController.createBox);

//Get All Boxes
router.get('/list', boxController.getAllBoxes);

//Get Single Box
router.get('/:id', boxController.getBoxById);

//Update Box
router.put('/update/:id', boxController.updateBox);

//Delete Box
router.delete('/delete/:id', boxController.deleteBox);


const auth =require("../utils/auth");

router.get(`/my-boxes`, auth, boxController.getMyBoxes);
router.get(`/other-boxes`, auth, boxController.getOtherUsersBoxes);  

module.exports = router;