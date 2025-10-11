var express = require('express');
const { plantDetailPage, checkPlantOwnership } = require('../controllers/plantDetailController');

var router = express.Router();

router.get('/checkOwnership/:plantId/:username', checkPlantOwnership);
router.get('/:plantID/:userName', plantDetailPage);

module.exports = router;