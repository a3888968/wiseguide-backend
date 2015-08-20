'use strict';

var async = require('async'),
    restler = require('restler'),
    apiUrl = process.argv[2],
    _ = require('lodash');

var systemId = 'sba' + Math.random(),
    centerLat = 51.440365,
    centerLon = -2.610246,
    appendQu = "Bristol UK",
    adminToken;

console.log("[SYSTEM ID:", systemId, "]");

var venues = [

    {
        Name: "Ashton Gate Primary School",
        Description: "We will have lots of events happening at the school, including performances from Year 5 and Year 6 students, food stalls, and lots of photography exhibitions.",
        Lat: 51.443208,
        Lon: -2.615054,
        Address: "Ashton Gate Primary School, Ashton Gate Road, Bristol, City of Bristol BS3 1SZ",
        Rooms: ["Main Hall", "Arts Room", "Playground"]
    },

    {
        Name: "115 Greville Road",
        Description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
        Lat: 51.442276,
        Lon: -2.606574,
        Address: "115 Greville Rd, Bristol, City of Bristol BS3 1LE",
        Rooms: ["Front Room", "Back Room"]
    },

    {
        Name: "St Pauls Church",
        Description: "Blandit imperdiet temporibus eos no, vel quas causae ponderum ut, qui eu brute commune principes. Vis facete accusam te. Pro an apeirian consetetur, sed id verterem necessitatibus, sed ut tollit homero scriptorem. Saepe contentiones vituperatoribus eu mei.",
        Lat: 51.445363,
        Lon: -2.599518,
        Address: "St Pauls Church, Coronation Rd, Bristol, City of Bristol BS3 1AS",
        Rooms: ["Main Hall", "Stage"]
    },

    {
        Name: "Tobacco Factory",
        Description: "Nec eirmod persecuti interesset at, ad modo assentior mei. Nec erant dicam ut, eu has rebum maluisset. At mutat justo neglegentur mei, primis luptatum eu sed. Scripserit dissentiet et mel. No putent feugait eam, no mea antiopam scriptorem. Fabulas praesent nec an, in nec errem ridens gubergren, duo cu exerci reprimique. Pro illud erant principes ea, mei omnesque molestie te.",
        Lat: 51.442301,
        Lon: -2.613489,
        Address: "The Tobacco Factory, Raleigh Rd, Bristol, City of Bristol BS3 1TF",
        Rooms: ["Stage 1", "Stage 2"]
    },

    {
        Name: "The Old Bookshop",
        Description: "Ut odio nusquam liberavisse eos, ex tale incorrupte his. Recusabo explicari cu usu, mazim doctus nostrum ne nec. Sit ad oblique persequeris, eam et tale ferri aliquam. Has et prompta corrumpit, cu suscipit singulis vel.",
        Lat: 51.440760,
        Lon: -2.604409,
        Address: "The Old Bookshop, 65 North St, Bristol, City of Bristol BS3 1ES",
        Rooms: ["Bar"]
    },

    {
        Name: "45 Lime Road",
        Description: "Eruditi urbanitas ea vis, id rebum reque aliquam est. Ius eu vivendum deseruisse. His regione mediocritatem ei. Sit invenire eleifend eu. Ut pro ignota iriure percipit.",
        Lat: 51.442564,
        Lon: -2.611730,
        Address: "45 Lime Rd, Bristol, City of Bristol BS3 1LS",
        Rooms: ["Front room", "Kitchen"]
    },

    {
        Name: "11 West View Road",
        Description: "Clita facete epicuri ne eum. Ei diam purto equidem vel, eos ad mazim iudicabit assentior. Ea vel utamur commune mandamus, sea congue suscipit urbanitas id. Errem officiis honestatis at eum, mucius veritus quo in, ullum commune platonem mel an. Eu sed eirmod vivendum, sit cu inermis docendi delicata.",
        Lat: 51.437026,
        Lon: -2.611210,
        Address: "11 West View Rd, Bristol, City of Bristol BS3 3JL",
        Rooms: ["Basement", "Front Garden"]
    },

    {
        Name: "Holy Cross RC Primary School",
        Description: "Blandit imperdiet temporibus eos no, vel quas causae ponderum ut, qui eu brute commune principes. Vis facete accusam te. Pro an apeirian consetetur, sed id verterem necessitatibus, sed ut tollit homero scriptorem. Saepe contentiones vituperatoribus eu mei.",
        Lat: 51.443610,
        Lon: -2.599968,
        Address: "Holy Cross RC Primary School, Dean Lane, Bedminster, Bristol, City of Bristol BS3 1DB",
        Rooms: ["Main hall", "Classroom A", "Classroom B", "Foyer"]
    },

    {
        Name: "SouthBank Club",
        Description: "Scripserit dissentiet et mel. No putent feugait eam, no mea antiopam scriptorem. Fabulas praesent nec an, in nec errem ridens gubergren, duo cu exerci reprimique. Pro illud erant principes ea, mei omnesque molestie te.",
        Lat: 51.443945,
        Lon: -2.599903,
        Address: "SouthBank Club, Dean Lane, Bristol, City of Bristol BS3 1DD",
        Rooms: ["Club"]
    },

    {
        Name: "52 Pearl Street",
        Description: "Eruditi urbanitas ea vis, id rebum reque aliquam est. Ius eu vivendum deseruisse. His regione mediocritatem ei. Scripserit dissentiet et mel. No putent feugait eam, no mea antiopam scriptorem. Fabulas praesent nec an, in nec errem ridens gubergren, duo cu exerci reprimique. Pro illud erant principes ea, mei omnesque molestie te.",
        Lat: 51.438836,
        Lon: -2.608236,
        Address: "52 Pearl St, Bristol, City of Bristol BS3 3EA",
        Rooms: ["Lounge", "Dining room"]
    },

];

var categories = [
    "Painting",
    "Sculpting",
    "Photography",
    "Music",
    "Theatre",
    "Comedy",
    "Food",
    "Art for sale",
];

var firstNames = [
    "Adam", "Ben", "Catherine", "Daniel", "Elijah", "Fred", "Grace", "Harriet", "Indigo", "Jessica", "Kelly", "Lily", "Minh", "Neil", "Oscar", "Petunia", "Quentin", "Roger", "Selena", "Ted", "Ursula", "Vivian", "Xi", "Yasmin", "Zu"
];

var lastNames = [
    "Anna", "Bell", "Cliff", "Drake", "Erman", "Fredwick", "Gardner", "Hargreaves", "Irfane", "Johnston", "Kelly", "Lee", "Mooney", "Nguyen", "Oakwell", "Paul", "Quinn", "Rosenburg", "Scott", "Taylor", "Upton", "Vincent", "Williams", "Young", "Zaoui"
];

function generateName() {
    return _.sample(firstNames) + " " + _.sample(lastNames);
}

function generateArtistEvent() {
    var artistName = generateName();
    return {
        Name: artistName,
        Categories: _.sample(["Painting", "Sculpting", "Photography", "Art for sale"], _.random(1, 2)),
        Description: _.sample(["Inspired by", "Thrilled at the vastness of", "Motivated by the values of", "Drawing upon elements of"]) + " " + generateName() + "'s " + _.sample(["impressionist work", "sculptures", "landscape photography", "human-focused photography projects", "controversial class-politics", "insights into local stereotypes"]) + ", " + artistName + "'s exhibition " + _.sample(["will excite you with its bold strokes and moments of genius.", "takes its visitors on a journey through space, time, and human emotion.", "is breathtaking in its beauty.", "is full of humour and heart and sure to be a memorable visit on your travels through the arts trail."]),
        Occurrences: [{
            Start: 1431770400000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431885600000
        }]
    };
}

function generateSeriousMusicEvent() {
    var name = generateName();
    return {
        Name: name,
        Categories: ["Music"],
        Description: name + "'s music is " + _.sample(["subtly layered with various electronic dance influences in a way", "a throwback to Motown", "a fresh twist on jazz", "a mash of eclectic genres"]) + " which is loved by " + _.sample(["kids and adults alike.", "the snobbiest of music snobs.", "everyone from Obama to Lady Gaga."]),
        Occurrences: _.take(_.shuffle([{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431785700000,
            End: 1431791100000
        }, {
            Start: 1431795600000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431864000000
        }, {
            Start: 1431869400000,
            End: 1431871200000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]), _.random(1, 4))
    };
}

function generateFunMusicEvent() {
    var name = _.sample(["The Southville Kid's Choir", "The Made-up Old Ladies Brass Band", "The Local Dog-walking Association Barber Shop", "The Ashton Gate PTA Acapella Group"]);
    return {
        Name: name,
        Categories: ["Music"],
        Description: name + " bring their " + _.sample(["hilarious", "adorable", "amazing"]) + " musical skills to the masses of South Bristol!",
        Occurrences: _.take(_.shuffle([{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431785700000,
            End: 1431791100000
        }, {
            Start: 1431795600000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431864000000
        }, {
            Start: 1431869400000,
            End: 1431871200000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]), _.random(1, 4))
    };
}

var events = [

    {
        Name: "Hilarious Harry",
        Categories: ["Comedy"],
        Description: "Harry is back with more impressions of the local Bristolian stereotypes we all know and love!",
        Occurrences: [{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]
    },


    {
        Name: "Joking Jenny",
        Categories: ["Comedy"],
        Description: "Jenny is back with more side-splitting insights into the mundanity of day-to-day life.",
        Occurrences: [{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]
    },


    {
        Name: "Falafel King",
        Categories: ["Food"],
        Description: "Delicious falafel wraps throughout the weekend!",
        Occurrences: [{
            Start: 1431770400000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431885600000
        }]
    },

    {
        Name: "Biblos",
        Categories: ["Food"],
        Description: "Mouth-watering Lebanese and Caribbean wraps and meze",
        Occurrences: [{
            Start: 1431770400000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431885600000
        }]
    },

    {
        Name: "Bedminster Hot Dogs",
        Categories: ["Food"],
        Description: "Support your local butchers by buying our artisan hot dogs",
        Occurrences: [{
            Start: 1431770400000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431885600000
        }]
    },

    {
        Name: "Bottelino's Pizza",
        Categories: ["Food"],
        Description: "Cheesy and tomatoey goodness",
        Occurrences: [{
            Start: 1431770400000,
            End: 1431799200000
        }, {
            Start: 1431856800000,
            End: 1431885600000
        }]
    },

    {
        Name: "A Hard Hitting Play",
        Categories: ["Theatre"],
        Description: "This short play (rated 'the most important performance piece of our era' by The Daily Fakepaper) transports its audience to the streets of Roughtown, and follows the lives of Bobby and Jake as they fight their way to the upper echelons of the most dangerous gang in England",
        Occurrences: [{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]
    },

    {
        Name: "A Happy Rainbow Adventure",
        Categories: ["Theatre"],
        Description: "Great for kids! Come and join the Radiotubbies on their adventure through Fluffyland.",
        Occurrences: [{
            Start: 1431775800000,
            End: 1431779400000
        }, {
            Start: 1431877500000,
            End: 1431880200000
        }]
    },

];

for (var j = 0; j < 20; j++) {
    events.push(generateArtistEvent());
    events.push(generateFunMusicEvent());
    events.push(generateSeriousMusicEvent());
}

function postWithToken(route, dataIn, cb) {
    restler.postJson(apiUrl + route, dataIn, {
        headers: {
            'Authorization': 'JWT ' + adminToken,
            'User-Agent': 'Restler for node.js',
            'Content-Type': 'application/json'
        }
    }).on('complete', function(data, response) {
        console.log(route, response.statusCode, JSON.stringify(data));
        return cb(data, response);
    });
}

async.series([

    function(cb) {
        restler.postJson(apiUrl + '/admin/systems/create/' + systemId, {
            Center: {
                Lat: centerLat,
                Lon: centerLon
            },
            AppendToLocationQuery: appendQu,
            User: {
                Username: 'admin',
                Email: 'someadminemailaddress@notarealdomain.xyz',
                Password: 'l0ngP4ssw0rd',
                Name: 'The Administrator',
                Biography: 'Some biography',
                Summary: 'Some summary'
            }
        }).on('complete', function(data, response) {
            adminToken = data.Token;
            console.log("[ADMIN TOKEN:", adminToken, "]");
            return cb();
        });
    },
    function(cb) {
        async.eachLimit(venues, 3, function(ven, cbv) {
            postWithToken("/api/venues/create", ven, function(data, response) {
                ven.VenueId = data.VenueId;
                setTimeout(cbv, 500);
            });
        }, cb);
    },
    function(cb) {
        async.eachLimit(categories, 3, function(cat, cbv) {
            postWithToken("/api/categories/create", {
                Name: cat
            }, function(data, response) {
                setTimeout(cbv, 500);
            });
        }, cb);
    },
    function(cb) {
        async.eachLimit(events, 2, function(ev, cbv) {
            for (var i in ev.Occurrences) {
                var ven = _.sample(venues);
                var room = _.sample(ven.Rooms);
                ev.Occurrences[i].VenueId = ven.VenueId;
                ev.Occurrences[i].Room = room;
            }
            if (ev.Name.length > 30) {
                ev.Name = ev.Name.substring(0, 27) + "...";
            }
            postWithToken("/api/events/create", ev, function(data, response) {
                ev.EventId = data.EventId;
                setTimeout(cbv, 500);
            });
        }, cb);
    },
]);