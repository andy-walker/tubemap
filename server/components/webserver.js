/**
 * Webserver component
 */

"use strict";

var express    = require('express');
var webapp     = express();
var webserver  = require('http').Server(webapp);
var io         = require('socket.io')(webserver);
var Promise    = require('bluebird');
var coroutine  = Promise.coroutine;
var path       = require('path');

var webroot = path.resolve(__dirname, '..', '..', 'client');

class Webserver {

    /**
     * Broadcast updated information for the specified lineId to 
     * all connected clients
     */
    broadcastUpdate(lineId) {

        var clientData = app.dataManager.getUpdate(lineId);
        console.log(clientData);
        io.emit('update', {
            'line': lineId,
            'data': clientData
        });

    }

    /**
     * Start webserver
     * @param config  configuration params for webserver
     * @returns {Promise}
     */
    start(config) {

        var server = this;
        config     = config || {};

        return new Promise((resolve, reject) => {

            var port  = 'port' in config ? config.port : 8080;
            var ip    = 'ip' in config ? config.ip : '0.0.0.0';

            webapp.use(express.static(webroot));

            // start web server ..
            webserver.listen(port, ip, 511, (error, result) => {
                
                if (error) {
                    app.log.error(error);
                    reject(error);
                } else {
                    app.log.info(`Listening for connections on port ${port}.`);
                    resolve();
                }

            });

            io.on('connection', function(socket) {
                console.log('socket connected!');
                // todo: send data
            });

        });

    }

}

module.exports = Webserver;