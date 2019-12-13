module.exports =
[
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display this usage guide.'
  },
  {
    name: 'version',
    alias: 'v',
    type: Boolean,
    description: 'Print version info'
  },
  {
    name: 'token',
    alias: 't',
    type: String,
    description: 'Quip Access Token. To generate a personal access token, visit the page: <https://quip.com/dev/token>',
    typeLabel: '{underline string}'
  },
  {
    name: 'destination',
    alias: 'd',
    type: String,
    description: 'Destination folder for export files',
    typeLabel: '{underline string}'
  },
  {
    name: 'zip',
    alias: 'z',
    type: Boolean,
    description: 'Zip export files'
  },
  {
    name: 'group-folder',
    type: Boolean,
    description: 'Optional group folder export'
  },
  {
    name: 'embedded-styles',
    type: Boolean,
    description: 'Embedded stylesheet in each document'
  },
  {
    name: 'debug',
    type: Boolean,
    description: 'Debug mode'
  }
];
