const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

/**
 * Synchronous read
 */
function readTextFile(filename) {
    const nFilename = path.normalize(filename);
    return fs.readFileSync(nFilename, 'utf-8');
}

/**
 * Synchronous write
 */
function writeTextFile(filename, text) {
    const nFilename = path.normalize(filename);
    mkdirp.sync(path.dirname(nFilename));
    fs.writeFileSync(nFilename, text);
}

function writeBlobFile(filename, blob) {
    const nFilename = path.normalize(filename);
    mkdirp.sync(path.dirname(nFilename));
    return new Promise((resolve, reject) =>
        blob.stream()
            .on('error', error => {
                if (blob.stream().truncated)
                // delete the truncated file
                    fs.unlinkSync(nFilename);
                reject(error);
            })
            .pipe(fs.createWriteStream(nFilename))
            .on('error', error => reject(error))
            .on('finish', () => resolve({ path }))
    );
}

module.exports = {
    readTextFile,
    writeTextFile,
    writeBlobFile,
};