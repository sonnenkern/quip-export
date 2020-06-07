const cliArguments = require('../CliArguments');
const help = require('../help');
const pkgVersion = require('../../../package.json').version;

const mkdirp = require('mkdirp');
jest.mock('mkdirp');
const rightFolder = 'c:\\temp';
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
    const params = '-d c:\\temp';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).toThrow('ERROR: Token is not defined.');
});

test('calling with right destination folder', () => {
    const params = '-t #TOKEN -d c:\\temp';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).not.toThrow();
});

test('calling with wrong destination folder', () => {
    const params = '-t #TOKEN -d c:\\temp123';
    process.argv = [null, null, ...params.split(' ')];
    expect(() => cliArguments()).toThrow('ERROR: Destination folder is wrong.');
});

test('default parameters', () => {
    const params = '-t #TOKEN -d c:\\temp';
    process.argv = [null, null, ...params.split(' ')];
    const result = cliArguments();
    expect(result['zip']).toBeFalsy();
    expect(result['embedded-images']).toBeFalsy();
    expect(result['embedded-styles']).toBeFalsy();
    expect(result['comments']).toBeFalsy();
    expect(result['docx']).toBeFalsy();
    expect(result['debug']).toBeFalsy();
});

test('setting parameters', () => {
    const params = '-t #TOKEN -d c:\\temp -z --embedded-styles --embedded-images --comments --debug --docx';
    process.argv = [null, null, ...params.split(' ')];
    const result = cliArguments();
    expect(result['token']).toBe('#TOKEN');
    expect(result['destination']).toBe('c:\\temp');
    expect(result['zip']).toBeTruthy();
    expect(result['embedded-images']).toBeTruthy();
    expect(result['embedded-styles']).toBeTruthy();
    expect(result['comments']).toBeTruthy();
    expect(result['docx']).toBeTruthy();
    expect(result['debug']).toBeTruthy();
});

test('folders option: wrong parameter', () => {
    const params = '-t #TOKEN -d c:\\temp --folders';
    process.argv = [null, null, ...params.split(' '), '   '];
    expect(() => cliArguments()).toThrow('ERROR: Folder\'s IDs are not set.');
});

test('folders option: right parameter', () => {
    const params = '-t #TOKEN -d c:\\temp --folders dddd,11111,3444';
    process.argv = [null, null, ...params.split(' ')];
    const result = cliArguments();
    expect(result['folders']).toEqual(['dddd','11111','3444']);
});