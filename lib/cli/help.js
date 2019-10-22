const commandLineUsage = require('command-line-usage');
const options = require('./options');
const pkgVersion = require('../../package.json').version;

module.exports = function() {
    return commandLineUsage([
        {
            header: `Quip-Export v${pkgVersion}`,
            content: 'Exports all folders and referenced files from an Quip-Account. ' +
                     'Current version exports only the files from Private and Shared Quip-folders.'
        },
        {
            header: 'Usage: quip-export package installed globally (npm install -g quip-export)',
            content: 'quip-export [options]'
        },
        {
            header: 'Usage: quip-export package installed locally (npm install quip-export)',
            content: 'node quip-export [options]'
        },
        {
            header: 'Typical Example',
            content: [
                'quip-export -t "<Quip API token>" -d <destination folder>',
                'quip-export -t "<Quip API token>" --zip'
            ]
        },
        {
            header: 'Options',
            optionList: options
        },
        {
            header: 'Project home',
            content: [
                '{underline https://github.com/sonnenkern/quip-export}',
                '{underline https://www.npmjs.com/package/quip-export}'
            ]
        }
    ]);
};