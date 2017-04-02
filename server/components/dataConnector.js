"use strict";

var coroutine   = require('bluebird').coroutine;
var request     = require('request');
var querystring = require('querystring');
var moment      = require('moment');

class DataConnector {

    constructor() {
        this.cache = {};
    }

    cacheArrivals(lineId, arrivals) {
        
        if (!(lineId in this.cache))
            this.cache[lineId] = {};

        var cache = this.cache[lineId];

        // keep a list of unique vehicleIDs present in arrivals - we'll use this
        // later to remove entries for any vehicle ids that are not in this list
        // eg: a vehicle is taken out of service
        var uniqueVehicleIds = {};

        for (let arrival of arrivals) {

            if (lineId == 'dlr') {
                //console.log(JSON.stringify(arrival, null, 2));
            }
                
            let vehicleId = arrival.vehicleId;
            uniqueVehicleIds[vehicleId] = null;
            
            if (!(vehicleId in cache))
                cache[vehicleId] = {
                    arrivals:     [],
                    atStation:    {},
                    lastDeparted: {}
                };

            cache[vehicleId].location = arrival.currentLocation;

            // if timestamp is in the past, ignore the record
            //if (moment(arrival.expectedArrival).unix() < moment().unix())
            //    continue;

            let cacheItem = {
                naptanId:            arrival.naptanId,
                stationName:         arrival.stationName,
                destinationNaptanId: arrival.destinationNaptanId,
                destinationName:     arrival.destinationName,
                timeToStation:       arrival.timeToStation,
                expectedArrival:     arrival.expectedArrival
            };

            // we want to end up with the first two arrivals in the array - this
            // allows us to extrapolate the direction in which we're travelling

            switch (cache[vehicleId].arrivals.length) {

                case 0:
                    cache[vehicleId].arrivals.push(cacheItem);
                    break;

                case 1:

                    // We seem to get duplicates of the same arrival in some cases, so check the
                    // naptanId does not already exist before adding
                    if (!this.valueExists(cache[vehicleId].arrivals, 'naptanId', cacheItem.naptanId)) {
                        
                        if (cacheItem.timeToStation > cache[vehicleId].arrivals[0].timeToStation)
                            cache[vehicleId].arrivals[1] = cacheItem;
                        else
                            cache[vehicleId].arrivals.unshift(cacheItem);

                    }
                    break;

                case 2:

                    // We seem to get duplicates of the same arrival in some cases, so check the
                    // naptanId does not already exist before adding
                    if (!this.valueExists(cache[vehicleId].arrivals, 'naptanId', cacheItem.naptanId)) {
                        
                        if (cacheItem.timeToStation < cache[vehicleId].arrivals[0].timeToStation)
                            cache[vehicleId].arrivals[0] = cacheItem;
                        else if (cacheItem.timeToStation < cache[vehicleId].arrivals[1].timeToStation)
                            cache[vehicleId].arrivals[1] = cacheItem;

                    }
                    break;

            }

            // check if location matches 'At ${arrivals[0].stationName}' - move first item to atStation if so
            let location    = cache[vehicleId].location;
            let nextStation = cache[vehicleId].arrivals[0].stationName.replace(/ (Underground|DLR) Station/, '');

            if (location.match(new RegExp(`^At ${nextStation} Platform.*$`)) || location.match(new RegExp(`^At ${nextStation}$`))) {
                
                cache[vehicleId].atStation = cache[vehicleId].arrivals.shift();
            
            // otherwise, if we have something in atStation, and the location doesn't match 'At ${arrivals[0].stationName}'
            // move contents of atStation to lastDeparted, mark departed time as now, and clear atStation
            } else if ('stationName' in cache[vehicleId].atStation) {

                let nextStation = cache[vehicleId].atStation.stationName.replace(/ (Underground|DLR) Station/, '');
                if (!location.match(new RegExp(`^At ${nextStation} Platform.*$`)) && !location.match(new RegExp(`^At ${nextStation}$`))) {
                    cache[vehicleId].lastDeparted = JSON.parse(JSON.stringify(cache[vehicleId].atStation));
                    cache[vehicleId].lastDeparted.departed = moment().format();
                    delete cache[vehicleId].lastDeparted.timeToStation;
                    cache[vehicleId].atStation = {};
                }

            }

        }

        // remove any cache entries for vehicles not present in arrivals
        for (let vehicleId in cache)
            if (!(vehicleId in uniqueVehicleIds))
                delete cache[vehicleId];

        /*
        if (lineId == 'central' || lineId == 'victoria') {
            console.log("\nNew cache:");
            console.log(JSON.stringify(this.cache[lineId], null, 2));
            console.log('Time now:', moment().format());
        }
        */



    }

    /**
     * Retrieve arrivals for a given lineId
     */
    getArrivals(lineId) {
        
        return new Promise(function(success, failure) {
            
            request(`https://api.tfl.gov.uk/line/${lineId}/arrivals`, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try {
                        var json = JSON.parse(body);
                    } catch (e) {
                        app.log.error(e.message);
                    }
                    /*
                    if (lineId == 'central' || lineId == 'victoria') {
                        console.log(lineId + ' success!');
                        console.log(JSON.stringify(json, null, 2));
                    }
                    */
                    success(json);
                } else {
                    console.error(error);
                    failure(error);
                }
            });

        });

    }

    getNaptanId(stationName) {
        
        return new Promise(function(success, failure) {
            
            var query = querystring.escape(`${stationName} Underground Station`);

            request(`https://api.tfl.gov.uk/StopPoint/Search?query=${query}`, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try {
                        var json = JSON.parse(body);
                    } catch (e) {
                        app.log.error(e.message);
                    }
                    if ('matches' in json && json.matches.length) {
                        for (let match of json.matches) {
                            if (match.modes.indexOf('tube') !== -1 && 'id' in match) {
                                success(match.id);
                                return;
                            }
                        }
                        failure(`Unable to get naptanId for ${stationName}`);                    
                    }

                } else {
                    failure(error);
                }
            });

        });

    }

    /**
     * Start the component
     */
    start() {

        return coroutine(function*(data) {

            var arrivals = yield data.getArrivals('metropolitan');
            data.cacheArrivals('metropolitan', arrivals);

            //console.log(JSON.stringify(data.cache.arrivals.metropolitan, null, 2));

        })(this).catch(app.log.error);

    }

    /**
     * Utility function to test if a key of a given value exists in an array of objects
     */
    valueExists(searchArray, objectKey, value) {
        
        for (let arrayItem of searchArray)
            if (arrayItem[objectKey] == value)
                return true;
        
        return false;

    }

}

module.exports = DataConnector;