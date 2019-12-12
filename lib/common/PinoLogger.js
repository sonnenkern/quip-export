const LoggerAdapter =  require('./LoggerAdapter');
const pino = require('pino');

class PinoLogger extends LoggerAdapter {
    constructor(level=LoggerAdapter.LEVELS.INFO, destination) {
        super(level, destination);
        this.logger = pino({
            level,
            prettyPrint: {
                ignore: 'pid,hostname',
                translateTime: 'SYS:dd-mm-yyyy HH:MM:ss.l',
                colorize: destination? false : true
            }
        }, destination);
    }

    debug (message)  { this.logger.debug(message); }
    info  (message)  { this.logger.info (message); }
    warn  (message)  { this.logger.warn (message); }
    error (message)  { this.logger.error(message); }
}


module.exports = PinoLogger;