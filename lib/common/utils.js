const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const npmview = require('npmview');
const semver  = require('semver');

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

    return new Promise((resolve) => {
        npmview(packageJson.name, function(err, version) {
            if(version) {
                versionsInfo.remoteVersion = version;
            }
            // compare to local version
            versionsInfo.localOutdate = semver.gt(versionsInfo.remoteVersion, versionsInfo.localVersion);
            resolve(versionsInfo);
        });
    });
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

async function blobImageToURL(blob) {
    return new Promise( (release) => {
        if(typeof window !== 'undefined') {
            const reader = new window.FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = function () {
                release(reader.result);
            }
        } else {
            const chunks = [];
            blob.stream().on('data', (chunk) => {
                chunks.push(chunk.toString('base64'));
            }).on('end', () => {
                release(`data:${blob.type};base64,${chunks.join('')}`);
            });
        }
    });
}

module.exports = {
    readTextFile,
    writeTextFile,
    writeBlobFile,
    getVersionInfo,
    cliBox,
    tryCatch,
    blobImageToURL
};