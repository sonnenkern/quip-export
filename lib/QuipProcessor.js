const QuipService =  require('./QuipService');
const Mime = require ('mime');
const ejs = require ('ejs');

class QuipProcessor {
    constructor (quipToken, saveCallback = ()=>{}, progressCallback =  ()=>{}, options={}) {
        this.quipToken = quipToken;
        this.saveCallback = saveCallback;
        this.progressCallback = progressCallback;
        this.options = options;

        this.start = false;
        this.threadsProcessed = 0;
        this.foldersProcessed = 0;

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        this.quipService = new QuipService(quipToken, options.quipApiURL);

        //parse options
        if(options.documentTemplate) {
            this.documentTemplate = options.documentTemplate;
        } else {
            console.error("Document template is not set!");
        }
    }

    async startExport() {
        console.log("START-EXPORT");
        this.start = true;
        this.threadsProcessed = 0;

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

        console.log("END-EXPORT: " + JSON.stringify(this.quipService.stats, null, 2));
    }

    stopExport() {
        this.start = false;
        console.log("STOP-EXPORT:" + JSON.stringify(this.quipService.stats, null, 2));
    }

    async processThread(quipThread, path) {
        //look up for blobs in html
        const regexp = new RegExp('/blob/([\\w-]+)/([\\w-]+)', 'gim');
        let regexpResult = regexp.exec(quipThread.html);

        const matches = [];

        while (regexpResult != null) {
            matches.push({
                threadId: regexpResult[1],
                blobId: regexpResult[2]
            });
            regexpResult = regexp.exec(quipThread.html);
        }

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

        const threadHtml = await this.processDocuments(wrappedHtml, matches, path);

        //const threadBlob = new Blob([threadHtml], {type: "text/html;charset=utf-8"});

        this.saveCallback(threadHtml, `${quipThread.thread.title}.html`, 'THREAD', path);
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

    async processDocuments(threadHtml, documents, path) {
        let html = threadHtml;

        //replace blob references
        for(const index in documents) {
            const document = documents[index];

            try {
                const blob = await this.quipService.getBlob(document.threadId, document.blobId);
                const blobRegexp = new RegExp(`/blob/${document.threadId}/${document.blobId}`, 'gim');
                html = html.replace(blobRegexp, `blobs/${document.blobId}.${Mime.getExtension(blob.type)}`);
                //blob.size
                this.saveCallback(blob, `${document.blobId}.${Mime.getExtension(blob.type)}`, "BLOB", path);
            }
            catch (e) {
                //do nothing
            }
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

        this.progressFolder(path);
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

        this.progressReport("Folders analyse...", "", `Folders: ${this.foldersTotal}, Threads: ${this.threadsTotal}`);

        let childFolders = [];
        if(folderIds.length > 0) {
            childFolders = await this.quipService.getFolders(folderIds);
        }

        for(const index in childFolders) {
            await this.countThreadsAndFolders(childFolders[index]);
        }
    }

    async exportFolders(folderIds) {
        this.threadsTotal = 0;
        this.foldersTotal = 0;

        const quipFolders = await this.quipService.getFolders(folderIds);

        for(const index in quipFolders) {
            await this.countThreadsAndFolders(quipFolders[index]);
        }

        console.log('***************', this.threadsTotal, this.foldersTotal);

        //console.log(JSON.stringify(anatomy, null, 2));

        return this.processFolders(quipFolders, "");
    }

    progressFolder(path) {
        this.progressReport("Export of documents...",
            Math.round((this.threadsProcessed/this.threadsTotal) * 100) + "%",
            "Folder: " + path);
    }

    progressReport(title, progress, message='') {
        this.progressCallback({
            title: title,
            message: message,
            progress: progress
        });
    }
}

module.exports = QuipProcessor;