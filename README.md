# Quip-Export
Comprehensive full automated export (backup) tool for [Quip](https://quip.com/).

Quip-Export uses official [Quip Automation API](https://quip.com/dev/automation/documentation) and exports all folders and referenced files from an Quip-Account. 
The documents are exported as HTML files with original Quip styling.
All referenced files and images in Quip document are saved in 'blobs' folder. 
Quip-Export allows optionally to export in a zip-file.

Slides are not supported (due to poor quality of generated PDFs).

Sometimes the export process goes not smooth and fast enough due to Quip API rate limits (HTTP 503: Over Rate Limit).

Despite Quip-Export is designed as a standalone tool for Node.js environment, it could be also used as Quip export library for any kind of JavaScript applications. 
In that case, the Quip-Export project is a good usage example.
 
Quip-Export perfectly works on Windows, Mac OS and Linux/Unix in Node.js or JavaScript (browser) environment.  

<p align="center">
  <img src="https://raw.githubusercontent.com/sonnenkern/quip-export/master/public/example-anim.gif">
</p>

## Online web app and demo
Full featured web app using Quip-Export package with demo mode is available on [www.quip-export.com](http://www.quip-export.com)

<p align="center">
  <img src="https://raw.githubusercontent.com/sonnenkern/quip-export/master/public/demo.gif">
</p>

## Install and usage
As mentioned before, Quip-Export tool needs Node.js (version 10.16 or higher) environment.
Node.js version check:
```
node -v
```
If Node.js is not installed or the version is lower than 10.16, please follow install/update instructions on [Node.js website](https://nodejs.org/en/).

### Use without installing locally
```
npx quip-export [options]
```
Advantage: you always run the latest version.

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

Install project dependencies:
```
cd quip-export
npm install
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
  --embedded-styles          Embedded in each document stylesheet
  --embedded-images          Embedded images
  --resolve-references       Resolves references to other Quip documents and folders to a proper relative path
  --debug                    Extended logging
```

To generate a personal access token, visit the page: [https://quip.com/dev/token](https://quip.com/dev/token)

## Usage examples
Export to folder c:\temp
```
quip-export -t "JHHHK222333444LLL1=" -d c:\temp
```
Export to current folder as destination
```
quip-export -t "JHHHK222333444LLL1="
```
Export in Zip-file with current folder as destination
```
quip-export -t "JHHHK222333444LLL1=" -z
```

## Logging
The export errors are written to file export.log in the destination folder.

## Troubleshooting
Quip-Export is strongly depending on the public [Quip Automation API](https://quip.com/dev/automation/documentation).
It is possible that some problems will occur if Quip Automation API is changed. Then Quip-Export adjustment is necessary.

In this case or other questions, please feel free to contact [info@quip-export.com](info@quip-export.com).