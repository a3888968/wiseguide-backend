'use strict';

function validateAgendaItem(agendaItem) {
    for (var prop in agendaItem) {
        if (typeof agendaItem[prop] === 'string')
            agendaItem[prop] = agendaItem[prop].trim();
    }

    if (agendaItem.hasOwnProperty('OccurrenceId') &&
        !(typeof agendaItem.OccurrenceId === 'string' && agendaItem.OccurrenceId))
        return 'bad_occurrence_id';

    if (agendaItem.hasOwnProperty('AgendaId') &&
        !(typeof agendaItem.AgendaId === 'string' && agendaItem.AgendaId))
        return 'bad_agenda_id';
}

exports.validateAgendaItem = validateAgendaItem;