'use strict';

/* 
This module handles endpoints regarding personal agendas. All endpoints begin /api/agendas
*/

var express = require('express');
var uuid = require('node-uuid');
var dbEvents = require('../database/events');
var dbAgendas = require('../database/agendas');
var dbAgendaItems = require('../database/agendaItems');
var dbSuggestedEvents = require('../database/suggestedEvents');
var utilsAgendas = require('../agendas/utils');
var utilsQueue = require('../utils/queue');
var utilsEvents = require('../events/utils');
// var async = require('async');

var router = express.Router();

/*
Adds an event occurrence to an agenda. First validates, then adds the event occurrence to the agenda in the database.
If no agenda is specified, creates a new agenda and returns the agenda ID in the response.
*/
router.post('/add', function(req, res) {
    if (req.headers['content-type'] !== 'application/json')
        return res.status(400).json({
            Error: 'wrong_content_type'
        }).send();

    var agendaItem = req.body;

    if (!(agendaItem.hasAllowedKeys(['AgendaId', 'OccurrenceId']) &&
        agendaItem.hasOwnProperty('OccurrenceId')))
        return res.status(400).json({
            Error: 'invalid_parameters'
        });

    var validationError = utilsAgendas.validateAgendaItem(agendaItem);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    dbEvents.getEventOccurrenceByIdRaw(req.systemId, agendaItem.OccurrenceId, function(err, occurrence) {
        if (err)
            return res.status(500).send();
        else if (!occurrence)
            return res.status(404).json({
                Error: 'occurrence_not_found'
            }).send();

        // if agenda ID not specified, generate a new ID and store in the database
        if (!agendaItem.hasOwnProperty('AgendaId')) {
            agendaItem.AgendaId = uuid.v4();
            dbAgendas.putAgenda(req.systemId, agendaItem.AgendaId, function(err, data) {
                if (err)
                    return res.status(500).send();

                addAgendaItem(true);
            });
        } else {
            //check agenda ID is valid, if it is, then add the event occurrence
            dbAgendas.checkAgendaExists(req.systemId, agendaItem.AgendaId, function(err, agendaExists) {
                if (!agendaExists)
                    return res.status(404).json({
                        Error: 'agenda_not_found'
                    }).send();
                addAgendaItem(false);
            });
        }

        function addAgendaItem(newAgenda) {
            dbAgendaItems.putAgendaItem(req.systemId, agendaItem.AgendaId, occurrence, function(err, data) {
                if (err) {
                    if (err === 'condition_violated')
                        return res.status(400).json({
                            Error: err
                        }).send();
                    return res.status(500).send();
                }
                if (newAgenda) {
                    res.status(200).json({
                        AgendaId: agendaItem.AgendaId
                    }).send();
                    utilsQueue.queueSystemAnalysis(req.systemId);
                    return;
                } else {
                    res.status(200).send();
                    utilsQueue.queueSystemAnalysis(req.systemId);
                    return;
                }
            });
        }
    });
});

router.get('/details/:agendaId', function(req, res) {
    dbAgendas.getAgendaById(req.systemId, req.params.agendaId, function(err, agenda) {
        if (err) {
            if (err === 'agenda_not_found')
                return res.status(404).json({
                    Error: err
                }).send();
            return res.status(500).send();
        }

        return res.status(200).json(agenda).send();
    });
});

router.get('/suggested/:agendaId', function(req, res) {
    dbSuggestedEvents.getSuggestedEventsForAgenda(req.systemId, req.params.agendaId, function(err, data) {
        if (err)
            return res.status(500).send();
        else if (data) {
            var evsBasic = [];
            for (var i = 0; i < data.length; i++) {
                evsBasic.push(utilsEvents.convertToEventBasic(data[i], !!req.user));
            }
            return res.status(200).json({
                Events: evsBasic
            }).send();
        } else {
            return res.status(200).json({
                Events: []
            }).send();
        }
    });
});

router.post('/remove', function(req, res) {
    if (req.headers['content-type'] !== 'application/json')
        return res.status(400).json({
            Error: 'wrong_content_type'
        }).send();

    var agendaItem = req.body;

    if (!agendaItem.hasKeys(['AgendaId', 'OccurrenceId']))
        return res.status(400).json({
            Error: 'invalid_parameters'
        });

    var validationError = utilsAgendas.validateAgendaItem(agendaItem);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    dbAgendaItems.deleteAgendaItem(req.systemId, agendaItem, function(err, data) {
        if (err) {
            if (err === 'condition_violated')
                return res.status(400).json({
                    Error: err
                }).send();
            return res.status(500).send();
        }
        res.status(200).send();
        utilsQueue.queueSystemAnalysis(req.systemId);
        return;
    });
});

module.exports = router;