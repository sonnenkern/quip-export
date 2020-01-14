jest.mock('node-fetch');
const fetch = require('node-fetch');
const {Response} = jest.requireActual('node-fetch');

jest.mock('../common/LoggerAdapter');

const waitingTime = Math.ceil((new Date().getTime() / 1000) + 2 ); //2 sec
const QuipService = require('../QuipService');

const response503 = new Response(JSON.stringify({waiting:waitingTime}), {
    status: 503,
    headers: {'x-ratelimit-reset': waitingTime}
});

//general error
const response500 = new Response("", {status: 500});

const blob = [1, 2, 3, 4, 5, 6];

const response200 = new Response(JSON.stringify({data:123456}));
const response200Blob = new Response(blob, {
    headers: {
        'content-type': 'image/jpeg',
        'content-length': blob.length,
        'content-disposition': 'attachment'
}
});

response200Blob.blob = jest.fn(() => blob);

const quipService = new QuipService('###TOKEN###', 'http://quip.com');



test('_apiCall response with 503 code', async () => {
    quipService.stats.query_count = 0;
    fetch.mockReturnValue(Promise.resolve(response200)).mockReturnValueOnce(Promise.resolve(response503));
    const res = await quipService._apiCall('/someURL');
    expect(res.data).toBe(123456);
    expect(quipService.stats.query_count).toBe(2);
});

test('_apiCall response with 500 code', async () => {
    fetch.mockReturnValue(Promise.resolve(response500));
    await quipService._apiCall('/someURL');
    expect(quipService.logger.debug).toHaveBeenCalledWith('Couldn\'t fetch /someURL, received 500');
});

test('_apiCall: fetch with exeption', async () => {
    const error = new Error('Some server error');
    fetch.mockImplementation(() => {
        throw error;
    });
    await quipService._apiCall('/someURL');
    expect(quipService.logger.error).toHaveBeenCalledWith('Couldn\'t fetch /someURL, ', error);
});

test('_apiCallBlob response with 503 code', async () => {
    quipService.stats.query_count = 0;
    fetch.mockReturnValue(Promise.resolve(response200Blob)).mockReturnValueOnce(Promise.resolve(response503));
    const res = await quipService._apiCallBlob('/someURL');
    expect(res).toBe(blob);
    expect(quipService.stats.query_count).toBe(2);
});

test('_apiCallBlob response with 500 code', async () => {
    fetch.mockReturnValue(Promise.resolve(response500));
    await quipService._apiCallBlob('/someURL');
    expect(quipService.logger.debug).toHaveBeenCalledWith('Couldn\'t fetch /someURL, received 500');
});

test('_apiCallBlob: fetch with exeption', async () => {
    const error = new Error('Some server error');
    fetch.mockImplementation(() => {
        throw error;
    });
    await quipService._apiCallBlob('/someURL');
    expect(quipService.logger.error).toHaveBeenCalledWith('Couldn\'t fetch /someURL, ', error);
});