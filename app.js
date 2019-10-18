const fs = require('fs');

const QuipProcessor =  require('./lib/QuipProcessor');
const utils = require('./lib/utils');


const documentTemplate = utils.readTextFile('./lib/templates/document.ejs');
const documentCSS = utils.readTextFile('./lib/templates/document.css');

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
    const quipProcessor = new QuipProcessor('Vk9RQU1BMmRPdlU=|1602966251|ptrt/tYmbr0yosibwnWzE1xxGZSO6qUpgm4PONjp+Ag=', fileSaver, progressFunc, {
        documentTemplate: documentTemplate
    });

    utils.writeTextFile("/Users/alex/Downloads/document.css", documentCSS);

    quipProcessor.startExport();
}

main();