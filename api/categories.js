"use strict";

/* 
This module handles endpoints regarding categories. All endpoints begin /api/categories
*/

var express = require('express');
var dbCategories = require('../database/categories');
var auth = require('../users/authentication');
var router = express.Router();
var validator = require('validator');


/*
Gets a list of all categories
*/
router.get('/all', function(req, res) {
    dbCategories.getAllCategories(req.systemId, function(err, cats) {
        if (err) {
            return res.status(500).send();
        } else {
            return res.status(200).json({
                Categories: cats
            }).send();
        }
    });
});


/*
Creates a new category. First validates that input is well formed:
- Category name is alphanumeric, 3-15 chars
Then puts it in the database
*/
router.post('/create', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.user.Role.indexOf("admin") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    if (typeof req.body.Name === 'string') req.body.Name = req.body.Name.trim();

    if (!(typeof req.body.Name === 'string' &&
        req.body.Name.length >= 3 &&
        req.body.Name.length <= 15 &&
        validator.isAlphanumeric(req.body.Name.split(" ").join(''))))
        return res.status(400).json({
            Error: "bad_name"
        }).send();

    dbCategories.putCategory(req.systemId, req.body.Name, function(err, data) {
        if (err) {
            if (err === "category_exists")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});


/*
Deletes a category from the database
*/
router.post('/delete/:categoryName', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.user.Role.indexOf("admin") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    req.params.categoryName = req.params.categoryName.trim();

    dbCategories.deleteCategory(req.systemId, req.params.categoryName, function(err, data) {
        if (err) {
            if (err === "category_not_found")
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
Edits the name of a category. First validates that input is well formed:
- New category name is alphanumeric, 3-15 chars
Then puts it in the database
*/
router.post('/edit/:categoryName', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.user.Role.indexOf("admin") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    if (typeof req.body.Name === 'string') req.body.Name = req.body.Name.trim();

    if (!(typeof req.body.Name === 'string' &&
        req.body.Name.length >= 3 &&
        req.body.Name.length <= 15 &&
        validator.isAlphanumeric(req.body.Name.split(" ").join(''))))
        return res.status(400).json({
            Error: "bad_name"
        }).send();

    req.params.categoryName = req.params.categoryName.trim();

    dbCategories.updateCategory(req.systemId, req.params.categoryName, req.body.Name, function(err, data) {
        if (err) {
            if (err === "category_not_found")
                return res.status(404).json({
                    Error: err
                }).send();
            else if (err === "category_exists")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});


module.exports = router;