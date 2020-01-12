const QuipProcessor = require('../QuipProcessor');

jest.mock('../QuipService');
const QuipService = require('../QuipService');

jest.mock('../common/LoggerAdapter');
const LoggerAdapter = require('../common/LoggerAdapter');


const constructorParams = {
    token: "TOKEN",
    saveCallback: jest.fn(),
    progressCallback: jest.fn(),
    phaseCallback: jest.fn()
};

const userFolders = {
    private_folder_id: 'p1',
    shared_folder_ids: ['s1', 's2', 's3'],
    group_folder_ids: ['g1', 'g2'],
};

const defaultOptions = {
    documentTemplate: "Document template"
};

let quipProcessor;

function initQuipProcessor(options = defaultOptions) {
    quipProcessor = new QuipProcessor(constructorParams.token, constructorParams.saveCallback, constructorParams.progressCallback,
        constructorParams.phaseCallback, options);
}

describe('constructor tests', () => {
    test('init paramteres', async () => {
        initQuipProcessor();

        expect(quipProcessor.quipToken).toBe(constructorParams.token);
        expect(quipProcessor.saveCallback).toBe(constructorParams.saveCallback);
        expect(quipProcessor.progressCallback).toBe(constructorParams.progressCallback);
        expect(quipProcessor.phaseCallback).toBe(constructorParams.phaseCallback);
        expect(quipProcessor.options).toBe(defaultOptions);
        expect(quipProcessor.logger).toBeInstanceOf(LoggerAdapter);

        expect(quipProcessor.start).toBe(false);

        expect(quipProcessor.threadsProcessed).toBe(0);
        expect(quipProcessor.foldersProcessed).toBe(0);
        expect(quipProcessor.threadsTotal).toBe(0);
        expect(quipProcessor.foldersTotal).toBe(0);

        expect(quipProcessor.phase).toBe('STOP');

        expect(quipProcessor.quipService).toBeInstanceOf(QuipService);

        expect(quipProcessor.documentTemplate).toBe(defaultOptions.documentTemplate);
    });

    test('without document template', async () => {
        console.error = jest.fn();
        initQuipProcessor({});
        expect(console.error).toHaveBeenCalledWith("Document template is not set!");
    });
});

describe('methods tests', () => {

    describe('setLogger', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('set logger', async () => {
            const customLogger = new LoggerAdapter();
            quipProcessor.setLogger(customLogger);
            expect(quipProcessor.logger).toBe(customLogger);
            expect(quipProcessor.quipService.setLogger).toHaveBeenCalledWith(customLogger);
        });
    });

    describe('startExport', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._exportFolders = jest.fn();
            quipProcessor._changePhase = jest.fn();
            quipProcessor.quipService.getUser.mockResolvedValue(userFolders);
        });

        test('changing phase', async () => {
            await quipProcessor.startExport();
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(1, 'START');
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(2, 'STOP');
        });

        test('set up internal vars', async () => {
            quipProcessor.threadsProcessed = 255;
            await quipProcessor.startExport();
            expect(quipProcessor.start).toBe(false);
            expect(quipProcessor.threadsProcessed).toBe(0);
        });

        test('call once QuipService.getUser()', async () => {
            await quipProcessor.startExport();
            expect(quipProcessor.quipService.getUser).toHaveBeenCalled();
        });

        test('calling QuipService.getUser() is failed', async () => {
            quipProcessor.quipService.getUser.mockResolvedValue(null);
            await quipProcessor.startExport();
            expect(quipProcessor.logger.error).toHaveBeenCalledWith('Can\'t load the User');
            expect(quipProcessor.start).toBe(false);
        });

        test('using folders from QuipService.getUser()', async () => {
            await quipProcessor.startExport();
            const folderIdsToExport = [
                userFolders.private_folder_id,
                ...userFolders.shared_folder_ids,
                ...userFolders.group_folder_ids
            ];
            expect(quipProcessor._exportFolders).toHaveBeenCalledWith(folderIdsToExport);
        });

        test('using folders from call parameter', async () => {
            const folderIdsToExport = [111,222,333];
            await quipProcessor.startExport(folderIdsToExport);
            expect(quipProcessor._exportFolders).toHaveBeenCalledWith(folderIdsToExport);
        });
    });

    describe('stopExport', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._changePhase = jest.fn();
        });

        test('stop export', async () => {
            quipProcessor.start = true;
            quipProcessor.stopExport();
            expect(quipProcessor.start).toBe(false);
            expect(quipProcessor._changePhase).toHaveBeenCalledWith('STOP');
        });
    });

    describe('_changePhase', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('change phase', async () => {
            quipProcessor.phase = 'NEW_PHASE';
            quipProcessor._changePhase('STOP');
            expect(quipProcessor.phase).toBe('STOP');
            expect(quipProcessor.phaseCallback).toHaveBeenCalledWith('STOP', 'NEW_PHASE');
        });
    });

    describe('_getMatches', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('get matches', async () => {
            const text = `
                href="/blob/thread1/id1?name=test1.pdf" 
                href="/blob/thread2/id2?name=test2.pdf"
                href="/blob/thread3/id3?name=test3.pdf"
            `;
            const regexp = new RegExp('href=\\"(.*/blob/(.+)/(.+)\\?name=(.+))\\"', 'gim');
            const result = quipProcessor._getMatches(text, regexp);
            expect(result.length).toBe(3);
            expect(result[1].replacement).toBe('/blob/thread2/id2?name=test2.pdf');
            expect(result[1].threadId).toBe('thread2');
            expect(result[1].blobId).toBe('id2');
            expect(result[1].fileName).toBe('test2.pdf');
        });
    });

    describe('_exportFolders', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('get matches', async () => {

        });
    });

});
