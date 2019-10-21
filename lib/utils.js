const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

/**
 * Synchronous read
 */
function readTextFile(filename) {
    filename = path.normalize(filename);
    return fs.readFileSync(filename, 'utf-8');
}

/**
 * Synchronous write
 */
function writeTextFile(filename, text) {
    filename = path.normalize(filename);
    mkdirp.sync(path.dirname(filename));
    fs.writeFileSync(filename, text);
}

function writeBlobFile(filename, blob) {
    filename = path.normalize(filename);
    mkdirp.sync(path.dirname(filename));
    return new Promise((resolve, reject) =>
        blob.stream()
            .on('error', error => {
                if (blob.stream().truncated)
                // delete the truncated file
                    fs.unlinkSync(filename);
                reject(error);
            })
            .pipe(fs.createWriteStream(filename))
            .on('error', error => reject(error))
            .on('finish', () => resolve({ path }))
    );
}

module.exports = {
    readTextFile,
    writeTextFile,
    writeBlobFile,
};