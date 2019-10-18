const QuipService =  require('./lib/QuipService');
const QuipProcessor = require('./lib/QuipProcessor');
const QuipProcessorAnatomy = require('./lib/QuipProcessorAnatomy');
const utils = require('./lib/utils');


const documentTemplate = utils.readFile('./lib/templates/document.ejs');
const documentCSS = utils.readFile('./lib/templates/document.css');

function blobSaver(blob, fileName, type, path) {
    if(type === 'DOCUMENT') {
        path = `${path}blobs`;
    }
    //zip.folder(path).file(fileName, blob, {base64: true});
    //FileSaver.saveAs(blob, fileName);
    console.log("SAVE: ", fileName, "PATH: ", path)
}

function progressFunc(progress) {
    console.log(JSON.stringify(progress, null, 2));
}


const quipProcessor = new QuipProcessorAnatomy('Vk9RQU1BS0xlWXU=|1601997827|E86Zjz3yBrPoelRHLBYdp1VYmUSautTO/HqLYBw2A0Y=', blobSaver, progressFunc, {
    documentTemplate: documentTemplate
});

quipProcessor.startExport().then(() => {

});