# Quip-Export
Comprehensive full automated export (backup) tool for [Quip](https://quip.com/).

Quip-Export uses official [Quip Automation API](https://quip.com/dev/automation/documentation) and exports all folders and referenced files from an Quip-Account. 
The doucuments exported as pretty looking HTML files with original Quip styling.
All referenced in document files and images saved in 'blobs' folder. 
Optionally Quip-Export provide export in a zip-file.

Current version exports only Private and Shared Quip-folders. 
Slides documents are not supported (poor quality of generated PDFs).

Sometimes the export could stumble and wait a bit, because of Quip API rate limits (HTTP 503: Over Rate Limit).  

Despite Quip-Export designed as a standalone tool for Node.js environment, it could be also used as Quip export library for any kind of JavaScript applications. 
In that case is the Quip-Export project a goot usage example.
 
Quip-Export perfectly works on Windows, Mac OS and Linux/Unix in Node.js or JavaScript (browser) environment.  

![Example image](https://raw.githubusercontent.com/sonnenkern/quip-export/master/public/example.png)

## Install
As mentioned before, Quip-Export tool needs Node.js (version 10.16 or higher) environment.
Node.js version check:
```
node -v
```
If Node.js not installed or version is lower than 10.16, please follow install/update instuktions on [Node.js website](https://nodejs.org/en/).

### Install and usage as global npm package
Install:
```
npm install -g quip-export
```

Usage example:
```
quip-export [options]
```

### Install and usage as a GitHUb project
Install:
```
git clone https://github.com/sonnenkern/quip-export.git
```

Usage example from project folder:
```
node quip-export [options]
```

### Install as an npm dependency in a project
Install:
```
npm install quip-export
```

## Options
```
  -h, --help                 Usage guide.
  -v, --version              Print version info
  -t, --token string         Quip Access Token.
  -d, --destination string   Destination folder for export files
  -z, --zip                  Zip export files
```

 To generate a personal access token, visit the page: [https://quip.com/dev/token](https://quip.com/dev/token)

## Usage examples
Export with destination folder c:\temp
```
quip-export -t "JHHHK222333444LLL1=" -d c:\temp
```
Export with current folder as destination
```
quip-export -t "JHHHK222333444LLL1="
```
Export in Zip-file with current folder as destination
```
quip-export -t "JHHHK222333444LLL1=" -z
```

## Troubleshooting
Quip-Export is strongly depend the public [Quip Automation API](https://quip.com/dev/automation/documentation).
It is possible, that some problems will occur, if Quip Automation API would be changed.

In this case please be free to contact [quip@sonnenkern.com](quip@sonnenkern.com).