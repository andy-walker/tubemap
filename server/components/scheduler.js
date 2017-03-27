/**
 * Cron-like scheduler allowing components to schedule jobs
 * 'when' format:
 *   *    *    *    *    *    *
 *   ┬    ┬    ┬    ┬    ┬    ┬
 *   │    │    │    │    │    |
 *   │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
 *   │    │    │    │    └───── month (1 - 12)
 *   │    │    │    └────────── day of month (1 - 31)
 *   │    │    └─────────────── hour (0 - 23)
 *   │    └──────────────────── minute (0 - 59)
 *   └───────────────────────── second (0 - 59, OPTIONAL)
 */
class Scheduler {
    
    constructor() {
        this.scheduler = require('node-schedule');
    }

    addJob(when, what) {
        this.scheduler.scheduleJob(when, what);
    }

}

module.exports = Scheduler;
