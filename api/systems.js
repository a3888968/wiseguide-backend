"use strict";

/* 
This module handles endpoints regarding systems. All endpoints begin /api/system
*/

var express = require('express');
var auth = require('../users/authentication');
var dbSystems = require('../database/systems');
var router = express.Router();

/*
Lets the admin of a system lock it to prevent further changes to data
*/
router.post('/lock', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.user.Role.indexOf("admin") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    dbSystems.updateSystem(req.systemId, {
        Lock: true
    }, function(err) {
        if (err) {
            if (err === "systemid_not_found")
                return res.status(404).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Lets the admin of a system unlock it to prevent further changes to data
*/
router.post('/unlock', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.user.Role.indexOf("admin") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    dbSystems.updateSystem(req.systemId, {
        Lock: false
    }, function(err) {
        if (err) {
            if (err === "systemid_not_found")
                return res.status(404).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Lets a logged in user find out if system is locked
*/
router.get('/islocked', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if(req.system.Lock)
        return res.status(423).send();
    else
        return res.status(200).send();
});

module.exports = router;