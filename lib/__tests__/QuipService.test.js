jest.mock('node-fetch');
const fetch = require('node-fetch');
const {Response} = jest.requireActual('node-fetch');

const waitingTime = Math.ceil((new Date().getTime() / 1000) + 2 ); //2 sec
const QuipService = require('../QuipService');

const quipService = new QuipService('###TOKEN###', 'http://quip.com');


test('response with 503 code', async () => {
    const response503 = new Response(JSON.stringify({waiting:waitingTime}), {
        status: 503,
        headers: {'x-ratelimit-reset': waitingTime}
    });
    const response200 = new Response(JSON.stringify({data:123456}));
    fetch.mockReturnValue(Promise.resolve(response200)).
          mockReturnValueOnce(Promise.resolve(response503));

    const res = await quipService.getUser();
    expect(res.data).toBe(123456);
    console.log(quipService.stats);
});

