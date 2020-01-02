const cliArguments = require('../CliArguments');
const help = require('../help');
const pkgVersion = require('../../../package.json').version;

const mkdirp = require('mkdirp');
jest.mock('mkdirp');
const rightFolder = 'c:\temp';
mkdirp.sync.mockImplementation((folder) => {
    if(rightFolder === folder) {
        return;
    }
    throw new Error();
});

test('calling with unknown parameter', () => {
    process.argv = [];
    process.argv[2] = '--wrongParameter';
    expect(() => cliArguments()).toThrow('Unknown option');
});

test('calling without any parameter', () => {
    process.argv = [];
    expect(() => cliArguments()).toThrow(help());
});

test('calling with -h parameter', () => {
    process.argv = [];
    process.argv[2] = '-h';
    expect(() => cliArguments()).toThrow(help());
});

test('calling with -v parameter', () => {
    process.argv = [];
    process.argv[2] = '-v';
    expect(() => cliArguments()).toThrow(pkgVersion);
});

test('calling without -t parameter', () => {
    const params = '-d c:\temp';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).toThrow('Token is not defined');
});

test('calling with right destination folder', () => {
    const params = '-t #TOKEN -d c:\temp';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).not.toThrow();
});

test('calling with wrong destination folder', () => {
    const params = '-t #TOKEN -d c:\temp123';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).toThrow('Destination folder is wrong');
});