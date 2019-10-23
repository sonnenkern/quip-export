const QuipService =  require('./QuipService');
const Mime = require ('mime');
const ejs = require ('ejs');
const sanitizeFilename = require("sanitize-filename");

class QuipProcessor {
    constructor (quipToken, saveCallback = ()=>{}, progressCallback =  ()=>{}, phaseCallback = ()=>{}, options={}) {
        this.quipToken = quipToken;
        this.saveCallback = saveCallback;
        this.progressCallback = progressCallback;
        this.phaseCallback = phaseCallback;
        this.options = options;

        this.start = false;
        this.threadsProcessed = 0;
        this.foldersProcessed = 0;

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        this.phase = 'STOP'; //START, STOP, ANALYSE, EXPORT

        this.quipService = new QuipService(quipToken, options.quipApiURL);

        //parse options
        if(options.documentTemplate) {
            this.documentTemplate = options.documentTemplate;
        } else {
            console.error("Document template is not set!");
        }
    }

    async startExport() {
        this._changePhase('START');

        this.start = true;
        this.threadsProcessed = 0;

        const user =  await this.quipService.getUser();

        const folderIdsToExport = [
            //user.desktop_folder_id,
            //user.archive_folder_id,
            //user.starred_folder_id,
            user.private_folder_id,
            //user.trash_folder_id
            ...user.shared_folder_ids
            //'XJXAOAeNRdL'
            //'GdFAOAxht8Y'
        ];

        await this._exportFolders(folderIdsToExport);

        this._changePhase('STOP');
    }

    stopExport() {
        this.start = false;
        this._changePhase('STOP');
    }

    _changePhase(phase) {
        this.phaseCallback(phase, this.phase);
        this.phase = phase;
    }

    _getMatches(text, regexp, threadId) {
        const matches = [];

        let regexpResult = regexp.exec(text);

        while (regexpResult != null) {
            if(regexpResult[2] === threadId) {
                matches.push({
                    replacement: regexpResult[1],
                    threadId: regexpResult[2],
                    blobId: regexpResult[3],
                    fileName: regexpResult[4]
                });
            }
            regexpResult = regexp.exec(text);
        }

        return matches;
    }

    async _processThread(quipThread, path) {
        //look up for images in html
        let regexp = new RegExp("src='(/blob/([\\w-]+)/([\\w-]+))'", 'gim');
        const matchesImg = this._getMatches(quipThread.html, regexp, quipThread.thread.id);

        //look up for links in html
        regexp = new RegExp('href=\\"(.*/blob/(.+)/(.+)\\?name=(.+))\\"', 'gim');
        const matchesLink = this._getMatches(quipThread.html, regexp, quipThread.thread.id);

        const pathDeepness = path.split("/").length-1;
        let wrappedHtml = quipThread.html;

        if(this.documentTemplate) {
            //wrap html code
            wrappedHtml = ejs.render(this.documentTemplate,{
                title: quipThread.thread.title,
                stylesheet_path: '../'.repeat(pathDeepness) + 'document.css',
                body: quipThread.html
            });
        }

        const threadHtml = await this._processFiles(wrappedHtml, [...matchesImg, ...matchesLink], path);
        this.saveCallback(threadHtml, sanitizeFilename(`${quipThread.thread.title}.html`), 'THREAD', path);
    }

    async _processThreads(quipThreads, path) {
        const promises = [];
        for(const index in quipThreads) {
            promises.push(this._processThread(quipThreads[index], path));
        }
        await Promise.all(promises);
    }

    async _processFolders(quipFolders, path) {
        const promises = [];
        for(const index in quipFolders) {
            promises.push(this._processFolder(quipFolders[index], `${path}${quipFolders[index].folder.title}/`));
        }
        await Promise.all(promises);
    }

    async _processFiles(threadHtml, files, path) {
        let html = threadHtml;

        //replace blob references
        for(const index in files) {
            const file = files[index];
            const blob = await this.quipService.getBlob(file.threadId, file.blobId);
            const fileName = sanitizeFilename(file.fileName || `${file.blobId}.${Mime.getExtension(blob.type)}`);

            html = html.replace(file.replacement, `blobs/${fileName}`);
            //blob.size
            this.saveCallback(blob, fileName, "BLOB", `${path}blobs`);
        }

        this.threadsProcessed++;

        return html;
    }

    async _processFolder(quipFolder, path) {
        const threadIds = [];
        const folderIds = [];

        for(const index in quipFolder.children) {
            const quipChild = quipFolder.children[index];

            if(quipChild.thread_id) { //thread
                threadIds.push(quipChild.thread_id);
            } else if(quipChild.folder_id) { //folder
                folderIds.push(quipChild.folder_id);
            }
        }

        if(threadIds.length > 0) {
            await
                this._processThreads(await this.quipService.getThreads(threadIds), path);
        }

        if(folderIds.length > 0) {
            await
                this._processFolders(await this.quipService.getFolders(folderIds), path);
        }

        this.foldersProcessed++;
        this._progressReport({
            threadsProcessed: this.threadsProcessed,
            threadsTotal: this.threadsTotal,
            path: path
        });
    }

    async _countThreadsAndFolders(quipFolder) {
        const threadIds = [];
        const folderIds = [];

        for(const index in quipFolder.children) {
            const quipChild = quipFolder.children[index];

            if(quipChild.thread_id) { //thread
                threadIds.push(quipChild.thread_id);
            } else if(quipChild.folder_id) { //folder
                folderIds.push(quipChild.folder_id);
            }
        }

        this.threadsTotal += threadIds.length;
        this.foldersTotal += folderIds.length;

        this._progressReport({
            readFolders: this.foldersTotal,
            readThreads: this.threadsTotal
        });

        let childFolders = [];
        if(folderIds.length > 0) {
            childFolders = await this.quipService.getFolders(folderIds);
        }

        for(const index in childFolders) {
            await this._countThreadsAndFolders(childFolders[index]);
        }
    }

    async _exportFolders(folderIds) {
        this._changePhase('ANALYSE');

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        const quipFolders = await this.quipService.getFolders(folderIds);

        for(const index in quipFolders) {
            await this._countThreadsAndFolders(quipFolders[index]);
        }

        this._changePhase('EXPORT');
        return this._processFolders(quipFolders, "");
    }

    _progressReport(progress) {
        this.progressCallback(progress);
    }
}

module.exports = QuipProcessor;