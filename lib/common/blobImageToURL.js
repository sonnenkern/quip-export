
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

module.exports = blobImageToURL;