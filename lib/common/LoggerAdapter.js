class LoggerAdapter {
    constructor(level=LoggerAdapter.LEVELS.INFO, destination) {
        this.level = level;
        this.destination = destination;
    }

    debug (/*message*/)  {}
    info  (/*message*/)  {}
    warn  (/*message*/)  {}
    error (/*message*/)  {}
}

LoggerAdapter.LEVELS = {
    DEBUG: 'debug',
    INFO:  'info',
    WARN:  'warn',
    ERROR: 'error'
};



module.exports = LoggerAdapter;