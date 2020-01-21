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

jest.mock('jszip');
const JSZip = require('jszip');
const JSZipMock = {file: jest.fn(), generateAsync: jest.fn()};
JSZip.mockImplementation(() => {
    return JSZipMock
});

function initApp() {
    console.log = jest.fn();
    CliArguments.mockReturnValue({destination: 'c:/temp'});
    QuipService.mockImplementation(() => {
        return {checkUser: () => true, setLogger: () => {}}
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
        await App.main();
        expect(console.log).toHaveBeenCalledWith("Message");
        expect(console.log).not.toHaveBeenCalledWith(`Quip-Export v1.33`);
    });

    test('CliArguments not throws exception', async () => {
        await App.main();
        expect(console.log).not.toHaveBeenCalledWith("Message");
        expect(console.log).toHaveBeenCalledWith(`Quip-Export v1.33`);
    });

    test('debug mode -> set up logger with debug level', async () => {
        CliArguments.mockReturnValue({destination: 'c:/temp', debug: true});
        const pinoLoggerObj = {error: ()=>{} };
        PinoLogger.mockImplementation(() => {
            return pinoLoggerObj;
        });
        await App.main();
        expect(PinoLogger).toHaveBeenCalledWith(PinoLogger.LEVELS.DEBUG, 'c:/temp/export.log');
        expect(App.Logger).toBe(pinoLoggerObj);
    });

    test('normal mode -> set up logger with info level', async () => {
        const pinoLoggerObj = {error: ()=>{} };
        PinoLogger.mockImplementation(() => {
            return pinoLoggerObj;
        });
        await App.main();
        expect(PinoLogger).toHaveBeenCalledWith(PinoLogger.LEVELS.INFO, 'c:/temp/export.log');
        expect(App.Logger).toBe(pinoLoggerObj);
    });

    test('localOutdate = true', async () => {
        Utils.getVersionInfo.mockResolvedValue({localVersion: '1.33', localOutdate: true});
        await App.main();
        expect(Utils.cliBox).toHaveBeenCalled();
    });

    test('setLogger for QuipService', async () => {
        const quipServiceMock = {checkUser: () => true, setLogger: jest.fn()}
        QuipService.mockImplementation(() => {
            return quipServiceMock
        });
        await App.main();
        expect(quipServiceMock.setLogger).toHaveBeenCalledWith(App.Logger);
    });

    test('User is available', async () => {
        await App.main();
        expect(console.log).toHaveBeenCalledWith(`Destination folder: c:/temp`);
    });

    test('User is not available', async () => {
        QuipService.mockImplementation(() => {
            return {checkUser: () => false, setLogger: () => {}}
        });
        await App.main();
        expect(console.log).toHaveBeenCalledWith(colors.red('ERROR: Token is wrong or expired.'));
        expect(console.log).not.toHaveBeenCalledWith(`Destination folder: c:/temp`);
    });

    test('activate zip', async () => {
        CliArguments.mockReturnValue({destination: 'c:/temp', zip: true});
        await App.main();
        expect(App.zip).toBe(JSZipMock);
    });
});