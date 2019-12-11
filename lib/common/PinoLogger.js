const LoggerAdapter =  require('./LoggerAdapter');
const pino = require('pino');

class PinoLogger extends LoggerAdapter {
    constructor(fileName, level=LoggerAdapter.LEVELS.INFO) {
        super(level, fileName);
        this.logger = pino({
            level,
            prettyPrint: {
                ignore: 'pid,hostname',
                translateTime: 'dd-mm-yyyy HH:MM:ss.l',
                colorize: fileName? false : true
            }
        }, fileName);
    }

    debug (message)  { this.logger.debug(message); }
    info  (message)  { this.logger.info (message); }
    warn  (message)  { this.logger.warn (message); }
    error (message)  { this.logger.error(message); }
}

module.exports = PinoLogger;