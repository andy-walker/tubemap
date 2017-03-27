"use strict";

var bluebird  = require('bluebird');
var coroutine = bluebird.coroutine;
var fs        = require('fs');

fs = bluebird.promisifyAll(fs);

class FileManager {

	getContents(filePath) {

        var log = app.log;

        return coroutine(function*(fileManager) {

            try {
                yield fs.statAsync(filePath);
            } catch (e) {
                log.error(`in FileManager - '${filePath}' does not exist.`);
                return false;
            }

            try {
                var fileData = yield fs.readFileAsync(filePath);
            } catch (e) {
                log.error(`in FileManager - '${filePath}' is not readable.`);
                return false;
            }

            return fileData;

        })(this).catch(log.error);
	}

}

module.exports = FileManager;