const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const semver  = require('semver');
const npmLatest = require('npm-latest');

const packageJson = require('../../package.json');

/*
Synchronous read
 */
function readTextFile(filename) {
    const nFilename = path.normalize(filename);
    return fs.readFileSync(nFilename, 'utf-8');
}

/*
Synchronous write
 */
function writeTextFile(filename, text) {
    const nFilename = path.normalize(filename);
    mkdirp.sync(path.dirname(nFilename));
    fs.writeFileSync(nFilename, text);
}
/*
fileExists 
*/
function fileExists(filename){
    return fs.existsSync(filename)
}
/*
write a blob
 */
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

/*
get npm package version information
 */
async function getVersionInfo() {
    const versionsInfo = {
        localVersion: packageJson.version,
        remoteVersion: packageJson.version,
        localOutdate: false
    };

    try {
        versionsInfo.remoteVersion = (await npmLatest.getLatest('quip-esxport')).version;
        // compare to local version
        versionsInfo.localOutdate = semver.gt(versionsInfo.remoteVersion, versionsInfo.localVersion);
    } catch(e) {
        // nothing to do
    }

    return versionsInfo;
}

//await tryCatch(() => quipService.getUser());
async function tryCatch(func, message) {
    return new Promise((resolve) => {
        func().then(res => resolve(res)).catch((e) => {
            if(message) { console.error(message); }
            console.error(e);
            resolve();
        });
    });
}

function cliBox(message) {
    let boxedMessage = `|  ${message}  |`;
    console.log('-'.repeat(boxedMessage.length));
    console.log(boxedMessage);
    console.log('-'.repeat(boxedMessage.length));
}

module.exports = {
    readTextFile,
    writeTextFile,
    writeBlobFile,
    getVersionInfo,
    cliBox,
    tryCatch,
    fileExists
};