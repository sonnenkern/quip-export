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

class Application {
    constructor() {
        this.Logger = {};
        this.desinationFolder;
        this.cliArguments;
        this.zip;
        this.quipProcessor;
        this.spinnerIndicator = new Spinner(' %s  read 0 folder(s) | 0 thread(s)');
        this.progressIndicator = new cliProgress.Bar({
            format: '   |{bar}| {percentage}% | {value}/{total} threads | ETA: {eta_formatted}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: false
        });
        this.updateProgess = ()=>{};
    }

    //main entry point
    async main() {
        const versionInfo = await utils.getVersionInfo();

        //cli arguments parsing and validation
        try {
            this.cliArguments = CliArguments();
        } catch (message) {
            console.log(message);
            return;
        }

        //current folder as destination, if not set
        this.desinationFolder = (this.cliArguments.destination || process.cwd());


        if(this.cliArguments.debug) {
            this.Logger = new PinoLogger(PinoLogger.LEVELS.DEBUG, `${this.desinationFolder}/export.log`);
        } else {
            this.Logger = new PinoLogger(PinoLogger.LEVELS.INFO, `${this.desinationFolder}/export.log`);
        }

        console.log(`Quip-Export v${versionInfo.localVersion}`);

        if(versionInfo.localOutdate) {
            utils.cliBox(`!!!! A new version of Quip-Export (v${versionInfo.remoteVersion}) is available.`);
        }

        //Token verification
        const quipService = new QuipService(this.cliArguments.token);
        quipService.setLogger(this.Logger);

        if(!await quipService.checkUser()) {
            console.log(colors.red('ERROR: Token is wrong or expired.'));
            return;
        }

        console.log(`Destination folder: ${this.desinationFolder}`);

        //activate zip
        if(this.cliArguments.zip) {
            this.zip = new JSZip();
        }

        this.quipProcessor = new QuipProcessor(this.cliArguments.token, fileSaver, progressFunc, phaseFunc,
            {
                documentTemplate,
                documentCSS: this.cliArguments['embedded-styles']? documentCSS : '',
                embeddedImages: this.cliArguments['embedded-images']
            });
        this.quipProcessor.setLogger(this.Logger);

        if(!this.cliArguments['embedded-styles']) {
            if(this.cliArguments.zip) {
                this.zip.file('document.css', documentCSS);
            } else {
                utils.writeTextFile(path.join(this.desinationFolder, "quip-export", 'document.css'), documentCSS);
            }
        }

        let foldersToExport = [
            //'FOLDER-1'
            //'FOLDER-2'
            //'EVZAOAW2e6U'
        ];

        this.quipProcessor.startExport(foldersToExport).then(() => {
            this.Logger.debug(this.quipProcessor.quipService.stats);
            if(this.cliArguments.zip) {
                //save zip file
                this.zip.generateAsync({type:"nodebuffer", compression: "DEFLATE"}).then(function(content) {
                    fs.writeFile(path.join(this.desinationFolder, 'quip-export.zip'), content, () => {
                        console.log("Zip-file has been saved: ", path.join(this.desinationFolder, 'quip-export.zip'));
                    });
                });
            }
        });
    }
}

const App = new Application();

/*
callback-function for file saving
*/
function fileSaver(data, fileName, type, filePath) {
    if(type === 'BLOB') {
        if(App.cliArguments.zip) {
            App.zip.folder(filePath).file(fileName, data.arrayBuffer());
        } else {
            utils.writeBlobFile(path.join(App.desinationFolder, "quip-export", filePath, fileName), data);
        }
    } else {
        if(App.cliArguments.zip) {
            App.zip.folder(filePath).file(fileName, data);
        } else {
            utils.writeTextFile(path.join(App.desinationFolder, "quip-export", filePath, fileName), data);
        }
    }
}

/*
callback-function for progress indication
*/
function progressFunc(progress) {
    App.updateProgess(progress);
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
        process.stdout.write(colors.gray(`Quip API: ${App.quipProcessor.quipService.apiURL}`));
        process.stdout.write('\n');
    }

    if (phase === 'ANALYSIS'){
        process.stdout.write('\n');
        process.stdout.write(colors.cyan('Analysing folders...'));
        process.stdout.write('\n');

        App.spinnerIndicator.setSpinnerDelay(80);
        App.spinnerIndicator.setSpinnerString("|/-\\");

        App.updateProgess = (progress) => {
            App.spinnerIndicator.text = ` %s  read ${progress.readFolders} folder(s) | ${progress.readThreads} thread(s)`;
        };

        App.spinnerIndicator.start();
    }

    if(prevPhase === 'ANALYSIS') {
        App.spinnerIndicator.onTick(`    read ${App.quipProcessor.foldersTotal} folder(s) | ${App.quipProcessor.threadsTotal} thread(s)`);
        App.spinnerIndicator.stop();
        process.stdout.write('\n');
    }

    if(phase === 'EXPORT') {
        process.stdout.write('\n');
        process.stdout.write(colors.cyan('Exporting...'));
        process.stdout.write('\n');


        App.progressIndicator.start(App.quipProcessor.threadsTotal, 0);
        App.updateProgess = (progress) => {
            App.progressIndicator.update(progress.threadsProcessed);
        };
    }

    if(prevPhase === 'EXPORT') {
        App.progressIndicator.stop();
        process.stdout.write('\n');
    }
}

module.exports = {App, documentTemplate, documentCSS};