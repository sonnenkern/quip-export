const QuipProcessor = require('../QuipProcessor');

const QuipService = require('../QuipService');
jest.mock('../QuipService');

const LoggerAdapter = require('../common/LoggerAdapter');
jest.mock('../common/LoggerAdapter');

const constructorParams = {
    token: "TOKEN",
    saveCallback: () => {},
    progressCallback: () => {},
    phaseCallback: () => {}
};

describe('constructor tests', () => {
    test('init paramteres', async () => {
        const options = {
            documentTemplate: "Document template"
        };
        const quipProcessor = new QuipProcessor(constructorParams.token, constructorParams.saveCallback, constructorParams.progressCallback,
            constructorParams.phaseCallback, options);

        expect(quipProcessor.quipToken).toBe(constructorParams.token);
        expect(quipProcessor.saveCallback).toBe(constructorParams.saveCallback);
        expect(quipProcessor.progressCallback).toBe(constructorParams.progressCallback);
        expect(quipProcessor.phaseCallback).toBe(constructorParams.phaseCallback);
        expect(quipProcessor.options).toBe(options);
        expect(quipProcessor.logger).toBeInstanceOf(LoggerAdapter);

        expect(quipProcessor.start).toBe(false);

        expect(quipProcessor.threadsProcessed).toBe(0);
        expect(quipProcessor.foldersProcessed).toBe(0);
        expect(quipProcessor.threadsTotal).toBe(0);
        expect(quipProcessor.foldersTotal).toBe(0);

        expect(quipProcessor.phase).toBe('STOP');

        expect(quipProcessor.quipService).toBeInstanceOf(QuipService);

        expect(quipProcessor.documentTemplate).toBe(options.documentTemplate);
    });

    test('without document template', async () => {
        const options = {};
        console.error = jest.fn();
        const quipProcessor = new QuipProcessor(constructorParams.token, constructorParams.saveCallback, constructorParams.progressCallback,
            constructorParams.phaseCallback, options);
        expect(console.error).toHaveBeenCalledWith("Document template is not set!");
    });
});

describe('methods tests', () => {
    const options = {
        documentTemplate: "Document template"
    };
    const quipProcessor = new QuipProcessor(constructorParams.token, constructorParams.saveCallback, constructorParams.progressCallback,
        constructorParams.phaseCallback, options);

    test('set logger', async () => {
        const customLogger = new LoggerAdapter();
        quipProcessor.setLogger(customLogger);
        expect(quipProcessor.logger).toBe(customLogger);
        expect(quipProcessor.quipService.setLogger).toHaveBeenCalledWith(customLogger);
    });
});
