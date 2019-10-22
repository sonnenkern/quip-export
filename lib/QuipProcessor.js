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

    changePhase(phase) {
        this.phaseCallback(phase, this.phase);
        this.phase = phase;
    }

    async startExport() {
        this.changePhase('START');

        this.start = true;
        this.threadsProcessed = 0;

        const user =  await this.quipService.getUser();

        const folderIdsToExport = [
            //user.desktop_folder_id,
            //user.archive_folder_id,
            //user.starred_folder_id,
            //user.private_folder_id,
            //user.trash_folder_id
            //...user.shared_folder_ids
            //'XJXAOAeNRdL'
            'GdFAOAxht8Y'
        ];

        await this.exportFolders(folderIdsToExport);

        this.changePhase('STOP');
    }

    stopExport() {
        this.start = false;
        this.changePhase('STOP');
    }

    getMatches(text, regexp, threadId) {
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

    async processThread(quipThread, path) {
        //look up for images in html
        let regexp = new RegExp("src='(\/blob\/([\\w-]+)\/([\\w-]+))'", 'gim');
        const matchesImg = this.getMatches(quipThread.html, regexp, quipThread.thread.id);

        //look up for links in html
        regexp = new RegExp('href=\\"(.*\/blob\/(.+)\/(.+)\\?name=(.+))\\"', 'gim');
        const matchesLink = this.getMatches(quipThread.html, regexp, quipThread.thread.id);

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

        const threadHtml = await this.processFiles(wrappedHtml, [...matchesImg, ...matchesLink], path);
        this.saveCallback(threadHtml, sanitizeFilename(`${quipThread.thread.title}.html`), 'THREAD', path);
    }

    async processThreads(quipThreads, path) {
        const promises = [];
        for(const index in quipThreads) {
            promises.push(this.processThread(quipThreads[index], path));
        }
        await Promise.all(promises);
    }

    async processFolders(quipFolders, path) {
        const promises = [];
        for(const index in quipFolders) {
            promises.push(this.processFolder(quipFolders[index], `${path}${quipFolders[index].folder.title}/`));
        }
        await Promise.all(promises);
    }

    async processFiles(threadHtml, files, path) {
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

    async processFolder(quipFolder, path) {
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
                this.processThreads(await this.quipService.getThreads(threadIds), path);
        }

        if(folderIds.length > 0) {
            await
                this.processFolders(await this.quipService.getFolders(folderIds), path);
        }

        this.foldersProcessed++;
        this.progressReport({
            threadsProcessed: this.threadsProcessed,
            threadsTotal: this.threadsTotal,
            path: path
        });
    }

    async countThreadsAndFolders(quipFolder) {
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

        this.progressReport({
            readFolders: this.foldersTotal,
            readThreads: this.threadsTotal
        });

        let childFolders = [];
        if(folderIds.length > 0) {
            childFolders = await this.quipService.getFolders(folderIds);
        }

        for(const index in childFolders) {
            await this.countThreadsAndFolders(childFolders[index]);
        }
    }

    async exportFolders(folderIds) {
        this.changePhase('ANALYSE');

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        const quipFolders = await this.quipService.getFolders(folderIds);

        for(const index in quipFolders) {
            await this.countThreadsAndFolders(quipFolders[index]);
        }

        this.changePhase('EXPORT');
        return this.processFolders(quipFolders, "");
    }

    progressReport(progress) {
        this.progressCallback(progress);
    }
}

module.exports = QuipProcessor;