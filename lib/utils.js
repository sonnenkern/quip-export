const fs = require('fs');

function readFile(path) {
    try {
        return fs.readFileSync(path, 'utf8');
    } catch(e) {
        console.log('Error:', e.stack);
    }
}


module.exports = {
    readFile: readFile
};