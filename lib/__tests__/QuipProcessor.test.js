const QuipProcessor = require('../QuipProcessor');

jest.mock('sanitize-filename');
const sanitizeFilename = require('sanitize-filename');
sanitizeFilename.mockImplementation((fileName) => `${fileName}_SANITIZED`);

jest.mock('ejs');
const ejs = require('ejs');
ejs.render.mockImplementation(() => 'TEMPLATED DOCUMENT');

jest.mock('../QuipService');
const QuipService = require('../QuipService');

jest.mock('../common/LoggerAdapter');
const LoggerAdapter = require('../common/LoggerAdapter');

jest.mock('../common/blobImageToURL');
const blobImageToURL = require('../common/blobImageToURL');
blobImageToURL.mockResolvedValue('IMAGE_URL');

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

const folders = require('./folders.json');
const threads = require('./threads.json');

const defaultOptions = {
    documentTemplate: "Document template",
    quipApiURL: "URL"
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

        expect(QuipService).toHaveBeenCalledWith("TOKEN", defaultOptions.quipApiURL);

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
            quipProcessor.quipService.getFolders.mockResolvedValue(folders);
            quipProcessor._countThreadsAndFolders = jest.fn();
            quipProcessor._processFolders = jest.fn();
            quipProcessor._changePhase = jest.fn();
        });

        test('pahse change in normal mode', async () => {
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(1, 'ANALYSIS');
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(2, 'EXPORT');
        });

        test('quipService.getFolders() is empty', async () => {
            quipProcessor.quipService.getFolders.mockResolvedValue();
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(1, 'ANALYSIS');
            expect(quipProcessor._changePhase).toHaveBeenNthCalledWith(2, 'STOP');
            expect(quipProcessor.logger.error).toHaveBeenCalledWith('Can\'t read the root folders');
        });

        test('reseting internal vars', async () => {
            quipProcessor.threadsTotal = 10;
            quipProcessor.foldersTotal = 10;
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor.threadsTotal).toBe(0);
            expect(quipProcessor.foldersTotal).toBe(0);
        });

        test('_countThreadsAndFolders should be called two times', async () => {
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenCalledTimes(2);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(1, folders['FOLDER-1']);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(2, folders['FOLDER-2']);
        });

        test('_countThreadsAndFolders should be called two times', async () => {
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenCalledTimes(2);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(1, folders['FOLDER-1']);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(2, folders['FOLDER-2']);
        });

        test('_processFolders should be called with right parameters', async () => {
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._processFolders).toHaveBeenCalledWith(folders, "");
        });
    });

    describe('_countThreadsAndFolders', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipService.getFolders.mockResolvedValue([{children: []}, {children: []}]);
            quipProcessor._progressReport = jest.fn();
        });

        test('count folders and threads, increase total counts, call progress report', async () => {
            quipProcessor.threadsTotal = 100;
            quipProcessor.foldersTotal = 100;
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1']);
            expect(quipProcessor.foldersTotal).toBe(100 + 13);
            expect(quipProcessor.threadsTotal).toBe(100 + 3);
            expect(quipProcessor._progressReport).toHaveBeenCalledWith({
                readFolders: quipProcessor.foldersTotal,
                readThreads: quipProcessor.threadsTotal
            });
        });

        test('find and count child folders', async () => {
            const mock___countThreadsAndFolders = jest.spyOn(quipProcessor, '_countThreadsAndFolders');
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1']);
            expect(quipProcessor.quipService.getFolders.mock.calls[0][0].length).toBe(13);
            expect(mock___countThreadsAndFolders).toHaveBeenCalledTimes(3);
        });

        test('getFolders returns no folders', async () => {
            quipProcessor.quipService.getFolders.mockResolvedValue(undefined);
            const mock___countThreadsAndFolders = jest.spyOn(quipProcessor, '_countThreadsAndFolders');
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1']);
            expect(mock___countThreadsAndFolders).toHaveBeenCalledTimes(1);
        });
    });

    describe('_processFolders', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._processFolder = jest.fn();
        });

        test('call _processFolder method', async () => {
            const mockFolders = {
                folder1: {
                    folder: {title: 'folder1'}
                },
                folder2: {
                    folder: {title: 'folder2'}
                }
            };
            await quipProcessor._processFolders(mockFolders, "/aaa/");
            expect(quipProcessor._processFolder).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFolder).toHaveBeenCalledWith(mockFolders.folder1, `/aaa/${mockFolders.folder1.folder.title}/`);
            expect(quipProcessor._processFolder).toHaveBeenCalledWith(mockFolders.folder2, `/aaa/${mockFolders.folder2.folder.title}/`);
        });
    });

    describe('_processFolder', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipService.getFolders.mockResolvedValue(folders);
            quipProcessor.quipService.getThreads.mockResolvedValue(threads);
            quipProcessor._processFolders = jest.fn();
            quipProcessor._processThreads = jest.fn();
            quipProcessor._progressReport = jest.fn();
            quipProcessor.foldersProcessed = 100;
        });

        test('call getThreads and getFolders', async () => {
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor.quipService.getFolders.mock.calls[0][0].length).toBe(13);
            expect(quipProcessor.quipService.getThreads.mock.calls[0][0].length).toBe(3);
        });

        test('call _processThreads and _processFolders', async () => {
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor._processFolders).toHaveBeenCalledWith(folders, '/aaa/');
            expect(quipProcessor._processThreads).toHaveBeenCalledWith(threads, '/aaa/');
        });

        test("couldn't get folders or threads", async () => {
            quipProcessor.quipService.getFolders.mockResolvedValue(undefined);
            quipProcessor.quipService.getThreads.mockResolvedValue(undefined);
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor.logger.error).toHaveBeenCalledWith("Can't load the Child-Folders for Folder: /aaa/");
            expect(quipProcessor.logger.error).toHaveBeenCalledWith("Can't load the Child-Threads for Folder: /aaa/");
        });

        test("increasing foldersProcessed variable", async () => {
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor.foldersProcessed).toBe(101);
        });

        test("call ProgressReport", async () => {
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor._progressReport).toHaveBeenCalledWith({
                threadsProcessed: 0,
                threadsTotal: 0,
                path: '/aaa/'
            });
        });
    });

    describe('_progressReport', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('report progress', async () => {
            const progress = {progress: 1};
            quipProcessor._progressReport(progress);
            expect(quipProcessor.progressCallback).toHaveBeenCalledWith(progress);
        });
    });

    describe('_processThreads', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._processThread = jest.fn();
        });

        test('call _processThread method', async () => {
            const mockThreads = {
                thread1: {
                    thread: {title: 'thread1'}
                },
                thread2: {
                    thread: {title: 'thread2'}
                }
            };
            await quipProcessor._processThreads(mockThreads, "/aaa/");
            expect(quipProcessor._processThread).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processThread).toHaveBeenCalledWith(mockThreads.thread1, `/aaa/`);
            expect(quipProcessor._processThread).toHaveBeenCalledWith(mockThreads.thread1, `/aaa/`);
        });
    });

    describe('_processThread', () => {
        let thread;

        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._processDocumentThread = jest.fn();
            thread = Object.assign({}, threads['THREAD-1']);
        });

        test('thread property is not defined', async () => {
            thread.thread = undefined;
            quipProcessor.threadsProcessed = 0;
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor.logger.error.mock.calls[0][0].startsWith('quipThread.thread is not defined, thread=')).toBe(true);
            expect(quipProcessor.threadsProcessed).toBe(0);
        });

        test("call _processDocumentThread() for docuement-type 'document'", async () => {
            thread.thread.type = 'document';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor._processDocumentThread).toBeCalledWith(thread, "/aaa/");
        });

        test("call _processDocumentThread() for docuement-type 'spreadsheet'", async () => {
            quipProcessor.threadsProcessed = 0;
            thread.thread.type = 'spreadsheet';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor._processDocumentThread).toBeCalledWith(thread, "/aaa/");
        });

        test("not supported document-type in thread", async () => {
            thread.thread.type = 'XXX';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor.logger.warn.mock.calls[0][0].startsWith('Thread type is not supported, thread.id=')).toBe(true);
        });
    });

    describe('_processSlidesThread', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('blob processing', async () => {
            const thread = threads['THREAD-1'];
            const blob = ['blob data'];
            const sanitizedName = sanitizeFilename(`${thread.thread.title.trim()}.pdf`);
            quipProcessor.quipService.getPdf.mockResolvedValue(blob);
            await quipProcessor._processSlidesThread(thread, '/aaa/');
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(blob, sanitizedName, 'BLOB', '/aaa/');
        });

        test('blob in undefined', async () => {
            const thread = threads['THREAD-1'];
            await quipProcessor._processSlidesThread(thread, '/aaa/');
            expect(quipProcessor.logger.warn.mock.calls[0][0].startsWith('Can\'t load Slides as PDF, thread.id=')).toBe(true);
        });
    });

    describe('_processSpreadsheetThread', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('blob processing', async () => {
            const thread = threads['THREAD-1'];
            const blob = ['blob data'];
            const sanitizedName = sanitizeFilename(`${thread.thread.title.trim()}.xlsx`);
            quipProcessor.quipService.getXlsx.mockResolvedValue(blob);
            await quipProcessor._processSpreadsheetThread(thread, '/aaa/');
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(blob, sanitizedName, 'BLOB', '/aaa/');
        });

        test('blob in undefined', async () => {
            const thread = threads['THREAD-1'];
            await quipProcessor._processSpreadsheetThread(thread, '/aaa/');
            expect(quipProcessor.logger.warn.mock.calls[0][0].startsWith('Can\'t load Spreadsheet as PDF, thread.id=')).toBe(true);
        });
    });

    describe('_processDocumentThread', () => {
        const thread = threads['THREAD-3'];
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._processFile = jest.fn();
            quipProcessor._processFile.mockImplementation((html) => `${html}_1`);
            ejs.render.mockClear();
            quipProcessor.options.documentCSS = undefined;
            quipProcessor.documentTemplate = undefined;
            quipProcessor.options.embeddedImages = undefined;
        });

        test('run without document template', async () => {
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFile).toHaveBeenCalledWith(thread.html, expect.anything(), '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledWith(`${thread.html}_1`, expect.anything(), '/aaa/', undefined);
            expect(ejs.render).toHaveBeenCalledTimes(0);
        });

        test('run with document template and embedded css', async () => {
            quipProcessor.documentTemplate = 'DOCUMENT_TEMPLATE';
            quipProcessor.options.documentCSS = "CSS";
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFile).toHaveBeenCalledWith('TEMPLATED DOCUMENT', expect.anything(), '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledWith('TEMPLATED DOCUMENT_1', expect.anything(), '/aaa/', undefined);
            expect(ejs.render).toHaveBeenCalledTimes(1);
            expect(ejs.render).toHaveBeenCalledWith('DOCUMENT_TEMPLATE', {
                title: thread.thread.title,
                body: thread.html,
                stylesheet_path: '',
                embedded_stylesheet: 'CSS'
            });
        });

        test('run with document template and without embedded css', async () => {
            quipProcessor.documentTemplate = 'DOCUMENT_TEMPLATE';
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFile).toHaveBeenCalledWith('TEMPLATED DOCUMENT', expect.anything(), '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledWith('TEMPLATED DOCUMENT_1', expect.anything(), '/aaa/', undefined);
            expect(ejs.render).toHaveBeenCalledTimes(1);
            expect(ejs.render).toHaveBeenCalledWith('DOCUMENT_TEMPLATE', {
                title: thread.thread.title,
                body: thread.html,
                stylesheet_path: '../'.repeat('/aaa/'.split("/").length-1) + 'document.css'
            });
        });

        test('run with embedded images', async () => {
            quipProcessor.options.embeddedImages = true;
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFile).toHaveBeenCalledWith(thread.html, expect.anything(), '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledWith(`${thread.html}_1`, expect.anything(), '/aaa/', true);
        });

        test('call saveCallback', async () => {
            const sanitizedName = sanitizeFilename(`${thread.thread.title.trim()}.html`);
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(`${thread.html}_1_1`, sanitizedName, 'THREAD', '/aaa/');
        });
    });

    describe('_processFile', () => {
        const blob = {data: 'bla bla bla', type:'application/pdf'};
        const fileInfo = {
            replacement: 'REPLACEMENT',
            threadId: 'THREAD_ID',
            blobId: 'BLOB_ID',
            fileName: '   FILE_NAME   ' //for trim test
        };

        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipService.getBlob.mockResolvedValue(blob);
        });

        test('blob read', async () => {
            await quipProcessor._processFile('HTML', fileInfo, '/aaa/', false);
            expect(quipProcessor.quipService.getBlob).toHaveBeenCalledWith(fileInfo.threadId, fileInfo.blobId);
        });

        test('blob can not be read', async () => {
            quipProcessor.quipService.getBlob.mockResolvedValue(undefined);
            await quipProcessor._processFile('HTML', fileInfo, '/aaa/', false);
            expect(quipProcessor.logger.error.mock.calls[0][0].startsWith('Can\'t load the file')).toBe(true);
        });

        test('blob processing as image', async () => {
            const returnedValue = await quipProcessor._processFile('HTML-REPLACEMENT', fileInfo, '/aaa/', true);
            expect(returnedValue).toBe('HTML-IMAGE_URL');
        });

        test('blob processing as file with fileName', async () => {
            const returnedValue = await quipProcessor._processFile('HTML-REPLACEMENT', fileInfo, '/aaa/', false);
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(blob, 'FILE_NAME_SANITIZED', 'BLOB', '/aaa/blobs');
            expect(returnedValue).toBe('HTML-blobs/FILE_NAME_SANITIZED');
            //`BLOB_ID.pdf`;
            //
        });

        test('blob processing as file without fileName', async () => {
            fileInfo.fileName = undefined;
            const returnedValue = await quipProcessor._processFile('HTML-REPLACEMENT', fileInfo, '/aaa/', false);
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(blob, 'BLOB_ID.pdf_SANITIZED', 'BLOB', '/aaa/blobs');
            expect(returnedValue).toBe('HTML-blobs/BLOB_ID.pdf_SANITIZED');
            //``;
            //
        });
    });
});


