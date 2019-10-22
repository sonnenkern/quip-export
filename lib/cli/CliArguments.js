const commandLineArgs = require('command-line-args');
const colors = require('colors');
const mkdirp = require('mkdirp');

const options = require('./options');
const help = require('./help');
const pkgVersion = require('../../package.json').version;

module.exports = function() {
    const cliArguments = commandLineArgs(options);

    if(cliArguments.help) {
        throw help();
    }

    if(cliArguments.version) {
        throw pkgVersion;
    }

    if(!cliArguments.token) {
        throw colors.red('ERROR: Token is not defined.');
    }

    if(cliArguments.destination) {
        try {
            mkdirp.sync(cliArguments.destination);
        } catch (e) {
            throw colors.red('ERROR: Destination folder is wrong.');
        }
    }

    return cliArguments;
};
