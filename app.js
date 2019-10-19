const fs = require('fs');

const QuipProcessor =  require('./lib/QuipProcessor');
const utils = require('./lib/utils');

const documentTemplate = utils.readTextFile(__dirname + '/lib/templates/document.ejs');
const documentCSS = utils.readTextFile(__dirname + '/lib/templates/document.css');

function fileSaver(data, fileName, type, path) {
    if(type === 'BLOB') {
        path = `${path}blobs`;
        utils.writeBlobFile("/Users/alex/Downloads/" + path + "/" + fileName, data);
    } else {
        utils.writeTextFile("/Users/alex/Downloads/" + path + "/" + fileName, data);
    }

    console.log("SAVE: ", fileName, "PATH: ", path);
}

function progressFunc(progress) {
    console.log(JSON.stringify(progress, null, 2));
}

function main() {
    console.log("MAIN");
    const quipProcessor = new QuipProcessor('Vk9RQU1BYTllSEs=|1603054318|mU687Hug22hqCLAZqKp6+lZi2O3/LVuehyNnFIAb2QI=', fileSaver, progressFunc, {
        documentTemplate: documentTemplate
    });

    utils.writeTextFile("/Users/alex/Downloads/document.css", documentCSS);

    quipProcessor.startExport();
}

module.exports = main;