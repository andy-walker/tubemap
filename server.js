"use strict";

var coroutine = require('bluebird').coroutine;

var Components = {
    DataConnector: require('./server/components/dataConnector'),
    DataManager:   require('./server/components/dataManager'),
    FileManager:   require('./server/components/fileManager'),
    Scheduler:     require('./server/components/scheduler'),
    Webserver:     require('./server/components/webserver')
};

/**
 * Main application container class
 */
class TubemapServer {

    constructor(params) {

        var path = require('path');
        
        this.params = params;
        this.log    = require('winston');
        this.dir    = path.resolve(__dirname, 'server');

        this.dataConnector  = new Components.DataConnector();
        this.dataManager    = new Components.DataManager(this);
        this.file           = new Components.FileManager();
        this.scheduler      = new Components.Scheduler();
        this.webserver      = new Components.Webserver();
        this.animationPaths = {};

    }

    /**
     * Start the application
     */
    start() {

        var log = app.log;

        coroutine(function*() {

            // generate animation paths, if required
            if ('initPaths' in app.params && app.params.initPaths) {
                
                log.info('Generating paths ...');
                
                var PathGenerator  = require('./server/utils/pathGenerator');
                var paths          = new PathGenerator();
                app.animationPaths = yield paths.generate();

            }

            yield app.dataConnector.start();
            yield app.webserver.start();

            app.scheduler.addJob('*/1 * * * * *', app.dataManager.runNextJob);


        })().catch(log.error);

    }

}

global.app = new TubemapServer({
    initPaths: false
});

app.start();