class LoggerAdapter {
    constructor(level=LoggerAdapter.LEVELS.DEBUG, fileName) {
        this.level = level;
        this. fileName = fileName;
        return undefined;
    }

    debug (message)  { console.log( `[${LoggerAdapter.LEVELS.DEBUG}] ` + message); }
    info  (message)  { console.log( `[${LoggerAdapter.LEVELS.INFO}] `  + message); }
    warn  (message)  { console.log( `[${LoggerAdapter.LEVELS.WARN}] `  + message); }
    error (message)  { console.log( `[${LoggerAdapter.LEVELS.ERROR}] ` + message); }
}

LoggerAdapter.LEVELS = {
    DEBUG: 'debug',
    INFO:  'info',
    WARN:  'warn',
    ERROR: 'error'
};



module.exports = LoggerAdapter;