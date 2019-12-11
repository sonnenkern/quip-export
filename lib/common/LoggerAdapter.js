class LoggerAdapter {
    constructor(level=LoggerAdapter.LEVELS.INFO, fileName) {
        this.level = level;
        this. fileName = fileName;
    }

    debug (message)  {}
    info  (message)  {}
    warn  (message)  {}
    error (message)  {}
}

LoggerAdapter.LEVELS = {
    DEBUG: 'debug',
    INFO:  'info',
    WARN:  'warn',
    ERROR: 'error'
};



module.exports = LoggerAdapter;