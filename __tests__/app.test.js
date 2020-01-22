const path =  require('path');
const fs = require('fs');

const {App} = require('../app');
const {documentTemplate, documentCSS} = require('../app');

const colors = require('colors');

const Utils = require('../lib/common/utils');
Utils.getVersionInfo = jest.fn();
Utils.cliBox = jest.fn();
Utils.getVersionInfo.mockResolvedValue({localVersion: '1.33'});

jest.mock('../lib/cli/CliArguments');
const CliArguments = require('../lib/cli/CliArguments');

jest.mock('../lib/common/PinoLogger');
const PinoLogger =  require('../lib/common/PinoLogger');

jest.mock('../lib/QuipService');
const QuipService = require('../lib/QuipService');

jest.mock('../lib/QuipProcessor');
const QuipProcessor = require('../lib/QuipProcessor');

jest.mock('jszip');
const JSZip = require('jszip');
const JSZipMock = {
    file: jest.fn(),
    generateAsync: jest.fn(() =>  new Promise((resolve) => {resolve('CONTENT')}))
};
JSZip.mockImplementation(() => {
    return JSZipMock
});

let app;

const pinoLoggerObj = {
    error: jest.fn(),
    debug: jest.fn()
};

function initApp() {
    app = new App();
    console.log = jest.fn();
    CliArguments.mockReturnValue({
        destination: 'c:/temp',
        token: 'TOKEN',
        ['embedded-styles']: true,
        ['embedded-images']: true
    });
    QuipService.mockImplementation(() => {
        return {
            checkUser: () => true,
            setLogger: () => {}
        }
    });

    QuipProcessor.mockImplementation(() => {
        return {
            startExport: jest.fn(() =>  new Promise((resolve) => {resolve('RESOLVED')})),
            setLogger: jest.fn(),
            quipService: {stats: 'STATS'}
        }
    });

    PinoLogger.mockImplementation(() => {
        return pinoLoggerObj;
    });
}

test('documentTemplate and documentCSS could be read', async () => {
    expect(documentTemplate.length > 0).toBe(true);
    expect(documentCSS.length > 0).toBe(true);
});


describe('constructor() tests', () => {
    beforeEach(() => {
        initApp();
    });
});

describe('main() tests', () => {
    beforeEach(() => {
        initApp();
    });

    test('CliArguments throws exception', async () => {
        CliArguments.mockImplementation(() => {
            throw 'Message';
        });
        await app.main();
        expect(console.log).toHaveBeenCalledWith("Message");
        expect(console.log).not.toHaveBeenCalledWith(`Quip-Export v1.33`);
    });

    test('CliArguments not throws exception', async () => {
        await app.main();
        expect(console.log).not.toHaveBeenCalledWith("Message");
        expect(console.log).toHaveBeenCalledWith(`Quip-Export v1.33`);
    });

    test('debug mode -> set up logger with debug level', async () => {
        CliArguments.mockReturnValue({destination: 'c:/temp', debug: true});
        await app.main();
        expect(PinoLogger).toHaveBeenCalledWith(PinoLogger.LEVELS.DEBUG, 'c:/temp/export.log');
        expect(app.Logger).toBe(pinoLoggerObj);
    });

    test('normal mode -> set up logger with info level', async () => {
        await app.main();
        expect(PinoLogger).toHaveBeenCalledWith(PinoLogger.LEVELS.INFO, 'c:/temp/export.log');
        expect(app.Logger).toBe(pinoLoggerObj);
    });

    test('localOutdate = true', async () => {
        Utils.getVersionInfo.mockResolvedValue({localVersion: '1.33', localOutdate: true});
        await app.main();
        expect(Utils.cliBox).toHaveBeenCalled();
    });

    test('init QuipService', async () => {
        await app.main();
        expect(QuipService).toHaveBeenCalledWith('TOKEN');
    });

    test('setLogger for QuipService', async () => {
        const quipServiceMock = {checkUser: () => true, setLogger: jest.fn()}
        QuipService.mockImplementation(() => {
            return quipServiceMock
        });
        await app.main();
        expect(quipServiceMock.setLogger).toHaveBeenCalledWith(app.Logger);
    });

    test('User is available', async () => {
        await app.main();
        expect(console.log).toHaveBeenCalledWith(`Destination folder: c:/temp`);
    });

    test('User is not available', async () => {
        QuipService.mockImplementation(() => {
            return {checkUser: () => false, setLogger: () => {}}
        });
        await app.main();
        expect(console.log).toHaveBeenCalledWith(colors.red('ERROR: Token is wrong or expired.'));
        expect(console.log).not.toHaveBeenCalledWith(`Destination folder: c:/temp`);
    });

    test('activate zip', async () => {
        CliArguments.mockReturnValue({destination: 'c:/temp', zip: true});
        await app.main();
        expect(app.zip).toBe(JSZipMock);
    });

    test('init QuipProcessor', async () => {
        await app.main();
        expect(QuipProcessor).toHaveBeenCalledWith('TOKEN', expect.anything(), expect.anything(), expect.anything(),
            {
                documentTemplate,
                documentCSS: documentCSS,
                embeddedImages: true
            }
        );
        expect(app.quipProcessor.setLogger).toHaveBeenCalledWith(app.Logger);
    });

    test('add css to zip', async () => {
        CliArguments.mockReturnValue({
            destination: 'c:/temp',
            token: 'TOKEN',
            ['embedded-styles']: false,
            ['embedded-images']: true,
            zip: true
        });
        await app.main();
        expect(app.zip.file).toHaveBeenCalledWith('document.css', documentCSS);
    });

    test('add css in file system', async () => {
        CliArguments.mockReturnValue({
            destination: 'c:/temp',
            token: 'TOKEN',
            ['embedded-styles']: false,
            ['embedded-images']: true,
            zip: false
        });
        Utils.writeTextFile = jest.fn();
        await app.main();
        expect(Utils.writeTextFile).toHaveBeenCalledWith(path.join('c:/temp', "quip-export", 'document.css'), documentCSS);
    });

    test('start export: zip', async () => {
        CliArguments.mockReturnValue({
            destination: 'c:/temp',
            token: 'TOKEN',
            ['embedded-styles']: true,
            ['embedded-images']: true,
            zip: true
        });
        fs.writeFile = jest.fn((path, content, cb) => cb());
        await app.main();
        expect(app.quipProcessor.startExport).toHaveBeenCalled();
        expect(app.Logger.debug).toHaveBeenCalledWith('STATS');
        expect(app.zip.generateAsync).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith("Zip-file has been saved: ", path.join(app.desinationFolder, 'quip-export.zip'));
    });
});