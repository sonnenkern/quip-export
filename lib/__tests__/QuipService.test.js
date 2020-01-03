jest.mock('node-fetch');
const fetch = require('node-fetch');
const {Response} = jest.requireActual('node-fetch');

const waitingTime = Math.ceil((new Date().getTime() / 1000) + 2 ); //2 sec
const QuipService = require('../QuipService');

const response503 = new Response(JSON.stringify({waiting:waitingTime}), {
    status: 503,
    headers: {'x-ratelimit-reset': waitingTime}
});

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
    fetch.mockReturnValue(Promise.resolve(response200)).
        mockReturnValueOnce(Promise.resolve(response503));
    const res = await quipService._apiCall('/someURL');
    expect(res.data).toBe(123456);
    expect(quipService.stats.query_count).toBe(2);
});

test('_apiCallBlob response with 503 code', async () => {
    fetch.mockReturnValue(Promise.resolve(response200Blob)).
        mockReturnValueOnce(Promise.resolve(response503));
    const res = await quipService._apiCallBlob('/someURL');
    expect(res).toBe(blob);
    expect(quipService.stats.query_count).toBe(4);
});
