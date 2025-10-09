var express = require('express');
const { plantDetailPage } = require('../controllers/plantDetailController');

var router = express.Router();

router.get('/:plantID/:userName', plantDetailPage);

module.exports = router;