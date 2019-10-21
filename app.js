const path =  require('path');

const QuipProcessor =  require('./lib/QuipProcessor');
const utils = require('./lib/utils');

const DESTINATION_PATH_WIN = 'C:\\temp';
const DESTINATION_PATH_MAC = '/Users/alex/Downloads/';
const DESTINATION_PATH = DESTINATION_PATH_WIN;

const documentTemplate = utils.readTextFile(path.join(__dirname, '/lib/templates/document.ejs'));
const documentCSS = utils.readTextFile(path.join(__dirname, '/lib/templates/document.css'));

function fileSaver(data, fileName, type, filePath) {
    if(type === 'BLOB') {
        filePath = `${filePath}blobs`;
        utils.writeBlobFile(path.join(DESTINATION_PATH, filePath, fileName), data);
    } else {
        utils.writeTextFile(path.join(DESTINATION_PATH, filePath, fileName), data);
    }

    console.log("SAVE: ", fileName, "PATH: ", filePath);
}

function progressFunc(progress) {
    console.log(JSON.stringify(progress, null, 2));
}

function main() {
    const quipProcessor = new QuipProcessor('Vk9RQU1BUVVpT0k=|1603192066|xH3VeBzLrpfO0pmLH2rigFNkAAgDzybiftYw76ovZKs=', fileSaver, progressFunc, {
        documentTemplate: documentTemplate
    });

    utils.writeTextFile(path.join(DESTINATION_PATH, 'document.css'), documentCSS);

    quipProcessor.startExport();
}

module.exports = main;