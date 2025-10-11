var express = require('express');
var router = express.Router();

router.get("/offline", (req, res) => {
    res.render("error/no-connection");
});

router.get("/404_error", (req, res) => {
    res.render("error/404_error");
});

module.exports = router;
