const TestUtils =  require('../common/TestUtils');

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

const quipUser = {
    url: 'https://demoaccount.quip.com',
    ...userFolders
};

const folders = require('./folders.json');
const threads = require('./threads.json');
const messages = require('./messages.json');

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

        expect(quipProcessor.referencesMap.size).toBe(0);

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
            quipProcessor.quipService.getCurrentUser.mockResolvedValue(quipUser);
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

        test('call once QuipService.getCurrentUser()', async () => {
            await quipProcessor.startExport();
            expect(quipProcessor.quipService.getCurrentUser).toHaveBeenCalled();
            expect(quipProcessor.quipUser).toBe(quipUser);
        });

        test('calling QuipService.getCurrentUser() is failed', async () => {
            quipProcessor.quipService.getCurrentUser.mockResolvedValue(null);
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
            TestUtils.mockResolvedWithThen(quipProcessor._exportFolders);
            await quipProcessor.startExport(folderIdsToExport);
            expect(quipProcessor._exportFolders).toHaveBeenCalledWith(folderIdsToExport);
            expect(quipProcessor._exportFolders.promiseCalledWithThenTimes).toBe(1);
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

    describe('_getMatchGroups', () => {
        beforeEach(() => {
            initQuipProcessor();
        });

        test('get matches for files', async () => {
            const text = `
                <a href="/blob/thread1/id1?name=test1.pdf">file1</a>
                <a href="/blob/thread2/id2?name=test2.pdf">file2</a>
                <a href="/blob/thread3/id3?name=test3.pdf">file3</a>
            `;
            const regexp = new RegExp('href="(?<replacement>.*/blob/(?<threadId>.+)/(?<blobId>.+)\\?name=(?<fileName>.+))"', 'gim');
            const result = quipProcessor._getMatchGroups(text, regexp);
            expect(result.length).toBe(3);
            expect(result[1].match).toBe('href="/blob/thread2/id2?name=test2.pdf"');
            expect(result[1].replacement).toBe('/blob/thread2/id2?name=test2.pdf');
            expect(result[1].threadId).toBe('thread2');
            expect(result[1].blobId).toBe('id2');
            expect(result[1].fileName).toBe('test2.pdf');
        });

        test('get matches for images', async () => {
            const text = `
                <img class='image' src='/blob/thread1/blob1'/> 
                <img class='image' src='/blob/thread2/blob2'/>
                <img class='image' src='/blob/thread3/blob3'/>
            `;
            const regexp = new RegExp("src='(?<replacement>/blob/(?<threadId>[\\w-]+)/(?<blobId>[\\w-]+))'", 'gim');
            const result = quipProcessor._getMatchGroups(text, regexp);
            expect(result.length).toBe(3);
            expect(result[1].match).toBe(`src='/blob/thread2/blob2'`);
            expect(result[1].replacement).toBe('/blob/thread2/blob2');
            expect(result[1].threadId).toBe('thread2');
            expect(result[1].blobId).toBe('blob2');
        });

        test('get matches for references', async () => {
            const text = `
                <a href="https://demoaccount.quip.com/reference1">fileA</a><br/> 
                <a href="https://demoaccount.quip.com/reference2">fileB</a> <br/>
                <a href="https://demoaccount.quip.com/reference3">folderAAA</a><br/>
                <a href="https://quip.com/reference4">folderBBB</a> <br/>
            `;
            const regexp = new RegExp(`href="(?<replacement>.*quip.com/(?<threadId>[\\w-]+))"`, 'gim');
            const result = quipProcessor._getMatchGroups(text, regexp);
            expect(result.length).toBe(4);
            expect(result[1].replacement).toBe('https://demoaccount.quip.com/reference2');
            expect(result[1].threadId).toBe('reference2');
            expect(result[3].replacement).toBe('https://quip.com/reference4');
            expect(result[3].threadId).toBe('reference4');
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
            TestUtils.mockResolvedWithThen(quipProcessor._countThreadsAndFolders);
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenCalledTimes(2);
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(1, folders['FOLDER-1'], "");
            expect(quipProcessor._countThreadsAndFolders).toHaveBeenNthCalledWith(2, folders['FOLDER-2'], "");
            expect(quipProcessor._countThreadsAndFolders.promiseCalledWithThenTimes).toBe(2);
        });

        test('_processFolders should be called with right parameters', async () => {
            await quipProcessor._exportFolders(['f1', 'f2']);
            expect(quipProcessor._processFolders).toHaveBeenCalledWith(folders, "");
        });
    });

    describe('_countThreadsAndFolders', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipService.getFolders.mockResolvedValue([
                {
                    folder: {id: 'FOLDER111'},
                    children: []
                },
                {
                    folder: {id: 'FOLDER222'},
                    children: []
                }
            ]);
            quipProcessor._progressReport = jest.fn();
        });

        test('count folders and threads, increase total counts, call progress report', async () => {
            quipProcessor.threadsTotal = 100;
            quipProcessor.foldersTotal = 100;
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1'], "Private/");
            //one folder is restricted
            expect(quipProcessor.foldersTotal).toBe(100 + 12);
            expect(quipProcessor.threadsTotal).toBe(100 + 3);
            expect(quipProcessor._progressReport).toHaveBeenCalledWith({
                readFolders: quipProcessor.foldersTotal,
                readThreads: quipProcessor.threadsTotal
            });
        });

        test('add references for folder and threads', async () => {
            quipProcessor.quipService.getFolders.mockResolvedValue([
                {
                    folder: {
                        title: "TITLE_" + Math.random() * 1000,
                        id: Math.random() * 1000
                    },
                    children: []
                },
                {
                    folder: {
                        title: "TITLE_" + Math.random() * 1000,
                        id: Math.random() * 1000
                    },
                    children: []
                }
            ]);
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1'], "Private/");
            expect(quipProcessor.referencesMap.size).toBe(6);
        });

        test('find and count child folders', async () => {
            const mock___countThreadsAndFolders = jest.spyOn(quipProcessor, '_countThreadsAndFolders');
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1'], "Private/");
            //one folder is restricted
            expect(quipProcessor.quipService.getFolders.mock.calls[0][0].length).toBe(12);
            expect(mock___countThreadsAndFolders).toHaveBeenCalledTimes(3);
        });

        test('getFolders returns no folders', async () => {
            quipProcessor.quipService.getFolders.mockResolvedValue(undefined);
            const mock___countThreadsAndFolders = jest.spyOn(quipProcessor, '_countThreadsAndFolders');
            await quipProcessor._countThreadsAndFolders(folders['FOLDER-1'], "Private/");
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
            //one folder is restricted
            expect(quipProcessor.quipService.getFolders.mock.calls[0][0].length).toBe(12);
            expect(quipProcessor.quipService.getThreads.mock.calls[0][0].length).toBe(3);
        });

        test('call _processThreads and _processFolders', async () => {
            TestUtils.mockResolvedWithThen(quipProcessor._processFolders);
            TestUtils.mockResolvedWithThen(quipProcessor._processThreads);
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor._processFolders).toHaveBeenCalledWith(folders, '/aaa/');
            expect(quipProcessor._processThreads).toHaveBeenCalledWith(threads, '/aaa/');
            expect(quipProcessor._processFolders.promiseCalledWithThenTimes).toBe(1);
            expect(quipProcessor._processThreads.promiseCalledWithThenTimes).toBe(1);
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
            quipProcessor.threadsProcessed = 10;
            quipProcessor.threadsTotal = 100;
            await quipProcessor._processFolder(folders['FOLDER-1'], "/aaa/");
            expect(quipProcessor._progressReport).toHaveBeenCalledWith({
                threadsProcessed: 10,
                threadsTotal: 100,
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

            TestUtils.mockResolvedWithThen(quipProcessor._processThread);

            await quipProcessor._processThreads(mockThreads, "/aaa/");
            expect(quipProcessor._processThread).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processThread).toHaveBeenCalledWith(mockThreads.thread1, `/aaa/`);
            expect(quipProcessor._processThread).toHaveBeenCalledWith(mockThreads.thread2, `/aaa/`);
            expect(quipProcessor._processThread.promiseCalledWithThenTimes).toBe(2);
        });
    });

    describe('_processThread', () => {
        let thread;

        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._processDocumentThread = jest.fn();
            thread = Object.assign({}, threads['THREAD-1']);
            quipProcessor.threadsProcessed = 0;
        });

        test('thread property is not defined', async () => {
            thread.thread = undefined;
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor.logger.error.mock.calls[0][0].startsWith('quipThread.thread is not defined, thread=')).toBe(true);
            expect(quipProcessor.threadsProcessed).toBe(0);
        });

        test("call _processDocumentThread() for docuement-type 'document'", async () => {
            thread.thread.type = 'document';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor._processDocumentThread).toBeCalledWith(thread, "/aaa/");
            expect(quipProcessor.threadsProcessed).toBe(1);
        });

        test("call _processDocumentThread() for docuement-type 'spreadsheet'", async () => {
            thread.thread.type = 'spreadsheet';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor._processDocumentThread).toBeCalledWith(thread, "/aaa/");
            expect(quipProcessor.threadsProcessed).toBe(1);
        });

        test("not supported document-type in thread", async () => {
            thread.thread.type = 'XXX';
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor.logger.warn.mock.calls[0][0].startsWith('Thread type is not supported, thread.id=')).toBe(true);
            expect(quipProcessor.threadsProcessed).toBe(1);
        });

        test("_processDocumentThread() called as Promise with await", async () => {
            thread.thread.type = 'document';
            TestUtils.mockResolvedWithThen(quipProcessor._processDocumentThread);
            await quipProcessor._processThread(thread, "/aaa/");
            expect(quipProcessor._processDocumentThread.promiseCalledWithThenTimes).toBe(1);
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

    describe('_resolveReferences', () => {
        const referenceMatches = [
            {
                replacement: 'https://demoaccount.quip.com/reference2',
                threadId: 'reference2'
            },
            {
                replacement: 'https://demoaccount.quip.com/reference3',
                threadId: 'reference3'
            }];

        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipUser = quipUser;
            quipProcessor._getMatchGroups = jest.fn(() => { return referenceMatches; });
            quipProcessor._processReference = jest.fn().mockResolvedValue("CHANGED-HTML");
        });

        test('resolve references', async () => {
            let result = await quipProcessor._resolveReferences("HTML", 3);
            expect(result).toBe("CHANGED-HTML");
            expect(quipProcessor._processReference).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processReference).toHaveBeenCalledWith('HTML', referenceMatches[0], 3);
            expect(quipProcessor._processReference).toHaveBeenCalledWith('CHANGED-HTML', referenceMatches[1], 3);
        });
    });

    describe('_processReference', () => {
        const html = `
            <html>
                <a href="https://quip.com/folder1">Folder 1</a>
                <a href="https://quip.com/threadXXX">Thread 1</a>
            </html>
        `;

        const folderReferencedObject = {
            folder: true,
            path: 'Private/Programming/',
            title: 'folder1'
        };

        const threadReferencedObject = {
            thread: true,
            path: 'Private/Programming/Angular/',
            title: 'thread1'
        };

        const folderReference = {
            replacement: 'https://quip.com/folder1',
            referenceId: 'folder1'
        };

        const threadReference = {
            replacement: 'https://quip.com/threadXXX',
            referenceId: 'threadXXX'
        };

        const htmlFolderAfter = `
            <html>
                <a href="../../../../Private/Programming/folder1">Folder 1</a>
                <a href="https://quip.com/threadXXX">Thread 1</a>
            </html>
        `;

        const htmlThreadAfter = `
            <html>
                <a href="https://quip.com/folder1">Folder 1</a>
                <a href="../../../../Private/Programming/Angular/thread1_SANITIZED.html">Thread 1</a>
            </html>
        `;

        beforeEach(() => {
            initQuipProcessor();
            quipProcessor._findReferencedObject = jest.fn();
        });

        test('referenced object not found', async () => {
            const result = await quipProcessor._processReference(html, {}, 4);
            expect(result).toBe(html);
        });

        test('referenced object is not thread or folder', async () => {
            quipProcessor._findReferencedObject.mockResolvedValue({user: true});
            const result = await quipProcessor._processReference(html, {}, 4);
            expect(result).toBe(html);
        });

        test('with folder', async () => {
            quipProcessor._findReferencedObject.mockResolvedValue(folderReferencedObject);
            const result = await quipProcessor._processReference(html, folderReference, 4);
            expect(result).toBe(htmlFolderAfter);
        });

        test('with thread', async () => {
            quipProcessor._findReferencedObject.mockResolvedValue(threadReferencedObject);
            const result = await quipProcessor._processReference(html, threadReference, 4);
            expect(result).toBe(htmlThreadAfter);
        });
    });

    describe('_processDocumentThread', () => {
        const thread = threads['THREAD-3'];
        const sanitizedName = sanitizeFilename(`${thread.thread.title.trim()}.html`);
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.quipUser = quipUser;
            quipProcessor._processFile = jest.fn();
            quipProcessor._processFile.mockImplementation((html) => `${html}_1`);
            quipProcessor.options.documentCSS = undefined;
            quipProcessor.options.messages = false;
            quipProcessor.documentTemplate = undefined;
            quipProcessor.options.embeddedImages = undefined;
            quipProcessor._renderDocumentHtml = jest.fn();
            quipProcessor._renderDocumentHtml.mockImplementation((html) => `${html}_WRAPPED`);
            quipProcessor._getThreadMessagesHtml = jest.fn();
            quipProcessor._getThreadMessagesHtml.mockImplementation(() => `MESSAGES_HTML`);
        });

        test('process document thread', async () => {
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledTimes(2);
            expect(quipProcessor._processFile).toHaveBeenCalledWith(`${thread.html}_1`, expect.anything(), '/aaa/');
            expect(quipProcessor._processFile).toHaveBeenCalledWith(thread.html, expect.anything(), '/aaa/', undefined);
            expect(quipProcessor._renderDocumentHtml).toHaveBeenCalledWith(`${thread.html}_1_1`, thread.thread.title, '/aaa/');
            expect(quipProcessor.saveCallback).toHaveBeenCalledWith(`${thread.html}_1_1_WRAPPED`, sanitizedName, 'THREAD', '/aaa/');
        });

        test('process document thread with messages', async () => {
            quipProcessor.options.comments = true;
            await quipProcessor._processDocumentThread(thread, '/aaa/');
            expect(quipProcessor._getThreadMessagesHtml).toHaveBeenCalledWith(thread, '/aaa/');
            expect(quipProcessor._renderDocumentHtml).toHaveBeenCalledWith(`${thread.html}_1_1MESSAGES_HTML`, thread.thread.title, '/aaa/');
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

    describe('_renderDocumentHtml', () => {
        beforeEach(() => {
            initQuipProcessor();
            ejs.render.mockClear();
        });

        test('without document template', async () => {
            quipProcessor.documentTemplate = undefined;
            const result = quipProcessor._renderDocumentHtml('HTML', 'Programming', 'aaa/bbb');
            expect(result).toBe('HTML');
        });

        test('with document template', async () => {
            quipProcessor.documentTemplate = 'DOCUMENT_TEMPLATE';
            quipProcessor.options.documentCSS = 'CSS';
            const result = quipProcessor._renderDocumentHtml('HTML', 'Programming', 'aaa/bbb');
            expect(ejs.render).toHaveBeenCalledWith('DOCUMENT_TEMPLATE', {
                title: 'Programming',
                body: 'HTML',
                stylesheet_path: '',
                embedded_stylesheet: 'CSS'
            });
            expect(result).toBe('TEMPLATED DOCUMENT');
        });

        test('without embedded css', async () => {
            quipProcessor.documentTemplate = 'DOCUMENT_TEMPLATE';
            quipProcessor.options.documentCSS = undefined;
            const result = quipProcessor._renderDocumentHtml('HTML', 'Programming', 'aaa/bbb');
            expect(ejs.render).toHaveBeenCalledWith('DOCUMENT_TEMPLATE', {
                title: 'Programming',
                body: 'HTML',
                stylesheet_path: '../document.css',
                embedded_stylesheet: undefined
            });
            expect(result).toBe('TEMPLATED DOCUMENT');
        });
    });

    describe('_findReferencedObject', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.referencesMap.set('folder1', {
                path: 'Private/Programming/',
                folder: true,
                title: 'Angular'
            });
            quipProcessor.referencesMap.set('thread1', {
                path: 'Private/Programming/Angular',
                thread: true
            });
            quipProcessor.quipService.getThread.mockImplementation((referenceId) => {
                if(referenceId === 'thread1') {
                    return Promise.resolve({thread: {id: 'thread1_obj', title: 'Thread1 Title'}});
                }
                if(referenceId === 'threadXXX') {
                    return Promise.resolve({thread: {id: 'thread1', title: 'ThreadXXX Title'}});
                }
                if(referenceId === 'threadYYY') {
                    return Promise.resolve({thread: {id: 'thread33', title: 'ThreadYYY Title'}});
                }
                return Promise.resolve();
            });
        });

        test('found referenced object', async () => {
            const result = await quipProcessor._findReferencedObject({referenceId: 'folder1'});
            expect(result).toBe(quipProcessor.referencesMap.get('folder1'));
        });

        test('referenced object is thread but title is undefined', async () => {
            const result = await quipProcessor._findReferencedObject({referenceId: 'thread1'});
            expect(result).toEqual({title: 'Thread1 Title', ...quipProcessor.referencesMap.get('thread1')});
        });

        test('referenced object is thread but could not find referenced thread', async () => {
            quipProcessor.quipService.getThread.mockResolvedValue();
            const result = await quipProcessor._findReferencedObject({referenceId: 'thread1'});
            expect(result).toBe(undefined);
        });

        test('referenced object not found, but referenced thread could be read', async () => {
            const result = await quipProcessor._findReferencedObject({referenceId: 'threadXXX'});
            const obj1 = quipProcessor.referencesMap.get('threadXXX');
            const obj2 = quipProcessor.referencesMap.get('thread1');
            expect(obj1).toEqual(obj2);
            expect(result).toEqual(obj1);
        });

        test('referenced object not found, but referenced thread could not be read', async () => {
            const result = await quipProcessor._findReferencedObject({referenceId: 'threadYYY'});
            expect(result).toBe(undefined);
        });

        test('referenced object is user', async () => {
            quipProcessor._findReferencedUser = jest.fn();
            quipProcessor._findReferencedUser.mockResolvedValue({name: 'Alex'});
            const result = await quipProcessor._findReferencedObject({referenceId: 'user1'});
            expect(result).toEqual({name: 'Alex'});
        });

        test('referenced object is user, and user could not be read', async () => {
            quipProcessor._findReferencedUser = jest.fn();
            quipProcessor._findReferencedUser.mockResolvedValue();
            const result = await quipProcessor._findReferencedObject({referenceId: 'user1'});
            expect(result).toEqual();
        });
    });

    describe('_findReferencedUser', () => {
        beforeEach(() => {
            initQuipProcessor();
            quipProcessor.referencesMap.set('user1', {
                name: 'Alex',
                user: true
            });
            quipProcessor.quipService.getUser.mockImplementation((referenceId) => {
                if(referenceId === 'userXXX') {
                    return Promise.resolve({name: 'Bruno'});
                }
                return Promise.resolve();
            });
        });

        test('user reference object found', async () => {
            const result = await quipProcessor._findReferencedUser({referenceId:'user1'});
            const obj1 = quipProcessor.referencesMap.get('user1');
            expect(result).toEqual(obj1);
        });

        test('user reference object not found, but user could be read', async () => {
            const result = await quipProcessor._findReferencedUser({referenceId:'userXXX'});
            const obj1 = quipProcessor.referencesMap.get('userXXX');
            expect(result.name).toBe('Bruno');
            expect(obj1.name).toBe('Bruno');
        });

        test('user reference object not found, but user could not be read', async () => {
            const result = await quipProcessor._findReferencedUser({referenceId:'userAAA'});
            expect(result).toBe(undefined);
        });
    });


    describe('_getThreadMessagesHtml', () => {
        beforeEach(() => {
            initQuipProcessor();

            quipProcessor.quipService.getThreadMessages.mockResolvedValue(messages);

            quipProcessor._findReferencedUser = jest.fn();
            quipProcessor._findReferencedUser.mockImplementation((reference) => {
                if(reference.referenceId === 'VKJAEAUa2PB') {
                    return Promise.resolve({name: 'Alex', user: true});
                }
                return Promise.resolve();
            });

            quipProcessor._findReferencedObject = jest.fn();
            quipProcessor._findReferencedObject.mockImplementation((reference) => {
                if(reference.referenceId === 'UPWAOAAEpFn') {
                    return Promise.resolve({title: 'Test', folder: true});
                }
                if(reference.referenceId === 'bgCMALIfAuaI') {
                    return Promise.resolve({title: 'Document-1', thread: true});
                }
                return Promise.resolve();
            });

            quipProcessor._processReference = jest.fn();
            quipProcessor._processReference.mockImplementation((html, reference) => {
                if(reference.referenceId === 'UPWAOAAEpFn') {
                    return Promise.resolve(html + 'PROCESSED-FOLDER');
                }
                if(reference.referenceId === 'bgCMALIfAuaI') {
                    return Promise.resolve(html + 'PROCESSED-THREAD');
                }
                return Promise.resolve();
            });

            quipProcessor._processFile = jest.fn();
            quipProcessor._processFile.mockImplementation((html, fileMatch) => {
                if(fileMatch.blobId === '1c2EXOl1sx04g5_hPNmt1A') {
                    return Promise.resolve(html + 'PROCESSED-FILE');
                }
                if(fileMatch.blobId === 'sVhMwHaxsgiwmfMi4au1Zg') {
                    return Promise.resolve(html + 'PROCESSED-FILE');
                }
                if(fileMatch.blobId === 'Ak5BJnkWubPxpIm4dtlWmg') {
                    return Promise.resolve(html + 'PROCESSED-IMAGE');
                }

                return Promise.resolve();
            });
        });

        test('thread with messages', async () => {
            const result = await quipProcessor._getThreadMessagesHtml({thread: {id: 'thread123'}}, 'Test/Programming/');
            expect(result).toMatchSnapshot();
        });

        test('thread without messages', async () => {
            quipProcessor.quipService.getThreadMessages.mockResolvedValue([]);
            let result = await quipProcessor._getThreadMessagesHtml({thread: {id: 'thread123'}}, 'Test/Programming/');
            expect(result).toBe('');
        });
    });

});


