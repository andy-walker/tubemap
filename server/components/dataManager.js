"use strict";

var coroutine = require('bluebird').coroutine;
var moment    = require('moment');

class DataManager {

    /**
     * Constructor
     */
    constructor(app) {
        
        // alias data connector cache
        this.cache = app.dataConnector.cache;
        this.lines = ['metropolitan', 'piccadilly', 'central', 'district', 'bakerloo', 'victoria', 'jubilee', 'northern'];

    }

    getUpdate(lineId) {
        
        var cache      = this.cache[lineId];
        var clientData = {};

        for (let vehicleId in this.cache[lineId]) {

            let vehicle = this.cache[lineId][vehicleId];

            // when we have no lastDeparted (or atStation) data, ie: on startup, ignore until we do
            if (!Object.keys(vehicle.lastDeparted).length && !Object.keys(vehicle.atStation).length)
                continue;

            let stopped = Object.keys(vehicle.atStation).length;

            if (stopped) {
                
                clientData[vehicleId] = {
                    'state':    'stopped',
                    'at':       vehicle.atStation.naptanId,
                    'atName':   vehicle.atStation.stationName,
                    'location': vehicle.location
                };

            } else {
                
                let departedTime = moment(vehicle.lastDeparted.departed).unix();
                let arrivalTime  = moment(vehicle.arrivals[0].expectedArrival).unix();
                let now          = moment().unix();    
                let startOffset  = (parseFloat(now - departedTime) / parseFloat(arrivalTime - departedTime)).toFixed(3);
                let duration     = arrivalTime - now;

                if (duration <= 0) {
                    // for now, do this to handle incorrect estimated arrivals ..
                    // .. just to get things working, but there's prb a better way to handle this!
                    clientData[vehicleId] = {
                        'state':    'stopped',
                        'at':       vehicle.arrivals[0].naptanId,
                        'atName':   vehicle.arrivals[0].stationName,
                        'location': vehicle.location
                    };

                } else {
                    clientData[vehicleId] = {
                        'state':    'animate',
                        'from':     vehicle.lastDeparted.naptanId,
                        'fromName': vehicle.lastDeparted.stationName,
                        'to':       vehicle.arrivals[0].naptanId,
                        'toName':   vehicle.arrivals[0].stationName,
                        'offset':   startOffset,
                        'duration': duration,
                        'location': vehicle.location
                    };
                }

            }

        }

        return clientData;

    }

    runNextJob() {
        
        return coroutine(function*(dataManager) {
            
            var line     = app.dataManager.lines.shift();
            var arrivals = yield app.dataConnector.getArrivals(line);

            app.dataConnector.cacheArrivals(line, arrivals);
            app.webserver.broadcastUpdate(line);
            app.dataManager.lines.push(line);

        })(this).catch(app.log.error);

    }

}

module.exports = DataManager;