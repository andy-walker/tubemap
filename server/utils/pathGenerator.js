"use strict";

var coroutine = require('bluebird').coroutine;
var cheerio   = require('cheerio');
var path      = require('path');
var yaml      = require('js-yaml');

/**
 * Utility class to read in information about route sections, and generate
 * animation paths from the svg
 */
class PathGenerator {

    constructor() {
        this.naptanIds = {};
    }

    /**
     * Main generation function
     */
    generate() {

        return coroutine(function*(pathGenerator) {

            var yamlFilePath = path.resolve(app.dir, 'data', 'paths.yml');
            var yamlData     = yield app.file.getContents(yamlFilePath);

            var svgFilePath = path.resolve(app.dir, 'data', 'tubemap.svg');
            var svg         = yield app.file.getContents(svgFilePath);

            try {
                var routeData = yaml.load(yamlData);
            } catch (e) {
                app.log.error(`Failed parsing ${yamlFilePath}: ${e.message}`);
                return false;
            }

            var stops = pathGenerator.getStopsForRoute(routeData, 'metropolitan');

            for (let stop of stops) {
                app.log.info(`Getting naptanId for ${stop} ...`);
                var naptanId = yield app.dataConnector.getNaptanId(stop);
                if (naptanId)
                    pathGenerator.naptanIds[stop] = naptanId;
                else
                    app.log.error(`Failed getting naptanId for ${stop}.`);
            }
            
            console.log(pathGenerator.naptanIds);
            var $        = cheerio.load(svg);
            var pathData = {};

            for (let lineId of ['metropolitan']) {
                
                pathData[lineId] = {};

                for (let routeSection in routeData[lineId]) {
                    
                    let stations = routeSection.split(' - ');
                    
                    if (!(stations[0] in pathGenerator.naptanIds)) {
                        app.log.error(`${stations[0]} not found in naptanId cache`);
                        continue;
                    }
                    
                    if (!(stations[1] in pathGenerator.naptanIds)) {
                        app.log.error(`${stations[1]} not found in naptanId cache`);
                        continue;
                    }
                    
                    let naptanId1  = pathGenerator.naptanIds[stations[0]],
                        naptanId2  = pathGenerator.naptanIds[stations[1]],
                        svgId      = routeData[lineId][routeSection],
                        pathKey    = `${naptanId1}-${naptanId2}`,
                        domElement = $(`#${svgId}`);

                    //console.log(pathKey, svgId);
                    if (domElement.is('line')) {
                        pathData[lineId][pathKey] = {
                            type: 'line',
                            x1:   domElement.attr('x1'),
                            x2:   domElement.attr('x2'),
                            y1:   domElement.attr('y1'),
                            y2:   domElement.attr('y2')
                        };
                    } else {
                        pathData[lineId][pathKey] = {
                            type: 'path',
                            d:    domElement.attr('d')
                        }
                    }

                }
            }
            
            return pathData;

        })(this).catch(app.log.error);

    }

    /**
     * Get a list of station names for the line in routeData
     */
    getStopsForRoute(routeData, lineId) {

        var journeys = Object.keys(routeData[lineId]);
        var stations = {};

        for (let journey of journeys) {
            let station = journey.split(' - ');
            stations[station[0]] = null;
            stations[station[1]] = null;
        }

        return Object.keys(stations);

    }

}

module.exports = PathGenerator;