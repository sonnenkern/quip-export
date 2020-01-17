const path =  require('path');
const Spinner = require('cli-spinner').Spinner;
const colors = require('colors');
const cliProgress = require('cli-progress');
const JSZip = require('jszip');
const fs = require('fs');

//PinoLogger implements LoggerAdapter-Interface
//It is possible to use another logger instead of PinoLogger
const PinoLogger =  require('./lib/common/PinoLogger');
const QuipProcessor =  require('./lib/QuipProcessor');
const QuipService =  require('./lib/QuipService');
const utils = require('./lib/common/utils');
const CliArguments = require('./lib/cli/CliArguments');

//EJS template for html documents
const documentTemplate = utils.readTextFile(path.join(__dirname, '/lib/templates/document.ejs'));
//CSS style for html documents
const documentCSS = utils.readTextFile(path.join(__dirname, '/lib/templates/document.css'));


let Logger;
let desinationFolder;
let cliArguments;
let zip;
let quipProcessor;
let spinnerIndicator, progressIndicator;
let updateProgess = ()=>{};

/*
callback-function for file saving
*/
function fileSaver(data, fileName, type, filePath) {
    if(type === 'BLOB') {
        if(cliArguments.zip) {
            zip.folder(filePath).file(fileName, data.arrayBuffer());
        } else {
            utils.writeBlobFile(path.join(desinationFolder, "quip-export", filePath, fileName), data);
        }
    } else {
        if(cliArguments.zip) {
            zip.folder(filePath).file(fileName, data);
        } else {
            utils.writeTextFile(path.join(desinationFolder, "quip-export", filePath, fileName), data);
        }
    }
}

/*
callback-function for progress indication
 */
function progressFunc(progress) {
    updateProgess(progress);
}


/*
callback-function for export life cycle phases
available phases:
    START - start of process
    STOP -  end of process
    ANALYSIS - folder/threads structure analysis
    EXPORT - export
 */
function phaseFunc(phase, prevPhase) {
    if(phase === 'START') {
        process.stdout.write(colors.gray(`Quip API: ${quipProcessor.quipService.apiURL}`));
        process.stdout.write('\n');
    }

    if (phase === 'ANALYSIS'){
        process.stdout.write('\n');
        process.stdout.write(colors.cyan('Analysing folders...'));
        process.stdout.write('\n');

        spinnerIndicator = new Spinner(' %s  read 0 folder(s) | 0 thread(s)');
        spinnerIndicator.setSpinnerDelay(80);
        spinnerIndicator.setSpinnerString("|/-\\");

        updateProgess = (progress) => {
            spinnerIndicator.text = ` %s  read ${progress.readFolders} folder(s) | ${progress.readThreads} thread(s)`;
        };

        spinnerIndicator.start();
    }

    if(prevPhase === 'ANALYSIS') {
        spinnerIndicator.onTick(`    read ${quipProcessor.foldersTotal} folder(s) | ${quipProcessor.threadsTotal} thread(s)`);
        spinnerIndicator.stop();
        process.stdout.write('\n');
    }

    if(phase === 'EXPORT') {
        process.stdout.write('\n');
        process.stdout.write(colors.cyan('Exporting...'));
        process.stdout.write('\n');

        progressIndicator = new cliProgress.Bar({
            format: '   |{bar}| {percentage}% | {value}/{total} threads | ETA: {eta_formatted}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: false
        });
        progressIndicator.start(quipProcessor.threadsTotal, 0);
        updateProgess = (progress) => {
            progressIndicator.update(progress.threadsProcessed);
        };
    }

    if(prevPhase === 'EXPORT') {
        progressIndicator.stop();
        process.stdout.write('\n');
    }
}

//main entry point
async function  main() {
    const versionInfo = await utils.getVersionInfo();

    //cli arguments parsing and validation
    try {
         cliArguments = CliArguments();
    } catch (message) {
        console.log(message);
        return;
    }

    //current folder as destination, if not set
    desinationFolder = (cliArguments.destination || process.cwd());


    if(cliArguments.debug) {
        Logger = new PinoLogger(PinoLogger.LEVELS.DEBUG, `${desinationFolder}/export.log`);
    } else {
        Logger = new PinoLogger(PinoLogger.LEVELS.INFO, `${desinationFolder}/export.log`);
    }

    console.log(`Quip-Export v${versionInfo.localVersion}`);

    if(versionInfo.localOutdate) {
        utils.cliBox(`!!!! A new version of Quip-Export (v${versionInfo.remoteVersion}) is available.`);
    }

    //Token verification
    const quipService = new QuipService(cliArguments.token);
    quipService.setLogger(Logger);

    if(!await quipService.checkUser()) {
        console.log(colors.red('ERROR: Token is wrong or expired.'));
        return;
    }

    console.log(`Destination folder: ${desinationFolder}`);

    //activate zip
    if(cliArguments.zip) {
        zip = new JSZip();
    }

    quipProcessor = new QuipProcessor(cliArguments.token, fileSaver, progressFunc, phaseFunc,
        {
            documentTemplate,
            documentCSS: cliArguments['embedded-styles']? documentCSS : '',
            embeddedImages: cliArguments['embedded-images']
        });
    quipProcessor.setLogger(Logger);

    if(!cliArguments['embedded-styles']) {
        if(cliArguments.zip) {
            zip.file('document.css', documentCSS);
        } else {
            utils.writeTextFile(path.join(desinationFolder, "quip-export", 'document.css'), documentCSS);
        }
    }

    let foldersToExport = [
        //'FOLDER-1'
        //'FOLDER-2'
        //'EVZAOAW2e6U'
    ];

    quipProcessor.startExport(foldersToExport).then(() => {
        Logger.debug(quipProcessor.quipService.stats);
        if(cliArguments.zip) {
            //save zip file
            zip.generateAsync({type:"nodebuffer", compression: "DEFLATE"}).then(function(content) {
                fs.writeFile(path.join(desinationFolder, 'quip-export.zip'), content, () => {
                    console.log("Zip-file has been saved: ", path.join(desinationFolder, 'quip-export.zip'));
                });
            });
        }
    });
}

module.exports = main;