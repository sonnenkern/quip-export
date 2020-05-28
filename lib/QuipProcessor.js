const QuipService =  require('./QuipService');
const Mime = require ('mime');
const ejs = require ('ejs');
const sanitizeFilename = require("sanitize-filename");
const LoggerAdapter = require('./common/LoggerAdapter');
const blobImageToURL = require('./common/blobImageToURL');


class QuipProcessor {
    constructor (quipToken, saveCallback = ()=>{}, progressCallback = ()=>{}, phaseCallback = ()=>{}, options={}) {
        this.quipToken = quipToken;
        this.saveCallback = saveCallback;
        this.progressCallback = progressCallback;
        this.phaseCallback = phaseCallback;
        this.options = options;
        this.logger = new LoggerAdapter();

        this.start = false;
        this.threadsProcessed = 0;
        this.foldersProcessed = 0;

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        this.referencesMap = new Map();

        this.phase = 'STOP'; //START, STOP, ANALYSIS, EXPORT

        this.quipService = new QuipService(quipToken, options.quipApiURL);

        //parse options
        if(options.documentTemplate) {
            this.documentTemplate = options.documentTemplate;
        } else {
            console.error("Document template is not set!");
        }
    }

    setLogger(logger) {
        this.logger = logger;
        this.logger.debug("-".repeat(80));
        this.quipService.setLogger(logger);
    }

    async startExport(folderIds) {
        this._changePhase('START');

        this.start = true;
        this.threadsProcessed = 0;

        this.quipUser = await this.quipService.getCurrentUser();
        if(!this.quipUser) {
            this.logger.error("Can't load the User");
            this.stopExport();
            return;
        }
        this.logger.debug("USER-URL: " + this.quipUser.url);

        let folderIdsToExport = [
            //this.quipUser.desktop_folder_id,
            //this.quipUser.archive_folder_id,
            //this.quipUser.starred_folder_id,
            this.quipUser.private_folder_id,
            //this.quipUser.trash_folder_id
            ...this.quipUser.shared_folder_ids,
            ...this.quipUser.group_folder_ids
        ];

        if(folderIds && folderIds.length > 0) {
            folderIdsToExport = folderIds;
        }

        await this._exportFolders(folderIdsToExport);

        this.stopExport();
    }

    stopExport() {
        this.start = false;
        this._changePhase('STOP');
    }

    _changePhase(phase) {
        this.phaseCallback(phase, this.phase);
        this.phase = phase;
    }

    _getMatchGroups(text, regexp) {
        const matches = {};
        let regexpResult;
        while ((regexpResult = regexp.exec(text)) != null) {
            matches[regexpResult[0]] = {match: regexpResult[0], ...regexpResult.groups};
        }
        return Object.values(matches);
    }

    async _resolveReferences(html, pathDeepness) {
        //look up for document or folder references
        const regexp = new RegExp(`href="(?<replacement>.*quip.com/(?<referenceId>[\\w-]+))"`, 'gim');
        const matchesReference = this._getMatchGroups(html, regexp);

        //replace references to documents
        if(this.options.resolveReferences) {
            for(const reference of matchesReference) {
                html = await this._processReference(html, reference, pathDeepness);
            }
        }

        return html;
    }

    async _findReferencedObject(reference) {
        let referencedObject = this.referencesMap.get(reference.referenceId);

        if(referencedObject) {
            if (referencedObject.thread && !referencedObject.title) {
                const referencedThread = await this.quipService.getThread(reference.referenceId);
                if(!referencedThread) {
                    this.logger.debug("_processReference: Couldn't load Thread with id=" + reference.referenceId);
                    return;
                }
                referencedObject.title = referencedThread.thread.title;
                referencedObject.thread = true;
            }

            return referencedObject;
        } else {
            const referencedThread = await this.quipService.getThread(reference.referenceId);
            if(referencedThread) {
                referencedObject = this.referencesMap.get(referencedThread.thread.id);
                if(!referencedObject) {
                    return;
                }
                referencedObject.title = referencedThread.thread.title;
                referencedObject.thread = true;
                this.referencesMap.set(reference.referenceId, referencedObject);
                return referencedObject;
            }

            const referencedUser = await this.quipService.getUser(reference.referenceId);
            if(referencedUser) {
                this.referencesMap.set(reference.referenceId, {
                    user: true,
                    name: referencedUser.name
                });

                return referencedObject;
            }

            this.logger.debug("_processReference: Couldn't find referenced object with referenceId=" + reference.referenceId);
        }

        return;
    }

    async _processReference(html, reference, pathDeepness) {
        let referencedObject = await this._findReferencedObject(reference);
        let path;

        if(!referencedObject) {
            return html;
        }

        if(!referencedObject.folder && !referencedObject.thread) {
            return html;
        }

        if(referencedObject.folder) {
            //folder
            path = '../'.repeat(pathDeepness) + referencedObject.path + referencedObject.title;
        } else {
            //thread
            path = '../'.repeat(pathDeepness) + referencedObject.path + sanitizeFilename(referencedObject.title.trim()) + '.html';
        }

        this.logger.debug(`_processReference: replacement=${reference.replacement}, path=${path}`);
        return html.replace(reference.replacement, path);
    }
    
    _renderDocumentHtml(html, title, path) {
        const pathDeepness = path.split("/").length-1;

        const documentRenderOptions = {
            title: title,
            body: html,
            stylesheet_path: '',
            embedded_stylesheet: this.options.documentCSS
        };

        if(!this.options.documentCSS) {
            documentRenderOptions.stylesheet_path = '../'.repeat(pathDeepness) + 'document.css';
        }

        if(this.documentTemplate) {
            //wrap html code
            return ejs.render(this.documentTemplate, documentRenderOptions);
        }

        return html;
    }
    
    /*async _getThreadMessagesHtml(quipThread) {
        let html = '';
        //get all messages for thread without annotation-messages
        const messages = (await this.quipService.getThreadMessages(quipThread.thread.id))
            .filter(msg => !msg.annotation)
            .sort((msg1, msg2) => msg1.createded_usec < msg2.createded_usec? 1 : -1);

        if(!messages || !messages.length) {
            return;
        }

        for(const message of messages) {
            let text = message.text.replace(/https/gim, ' https');
            const regexp = new RegExp(`https://.*?quip.com/(?<referenceId>[\\w-]+)`, 'gim');

            //document, user and folder references
            const matchesReferences = this._getMatchGroups(text, regexp);
            for(const reference of matchesReferences) {
                const referencedObject = await this._findReferencedObject(reference);
                const title = referencedObject.user? referencedObject.name : referencedObject.title;
                text = text.replace(reference.match, `<a href="${reference.match}">${title}</a>`);
            }

            //file and image references
            if(message.files) {
                for(const file of message.files) {
                    if(Mime.getType(file.name).startsWith('image/')) {
                        //image
                        text += `<br/><img class='message--image' src='/blob/${quipThread.thread.id}/${file.hash}'></img><br/>`;
                    } else {
                        //file
                        text += `<br/><a href="https://quip.com/-/blob/${quipThread.thread.id}/${file.hash}?name=${file.name}">${file.name}</a><br/>`;
                    }
                }
            }

            html += `<div class="message">${text}</div>`;
        }

        return `<div class='messagesBlock'>${html}</div>`;
    }*/

    async _processDocumentThread(quipThread, path) {
        const pathDeepness = path.split("/").length-1;
        let threadHtml = quipThread.html;
        
        /*const messagesHtml = await this._getThreadMessagesHtml(quipThread);

        if(messagesHtml) {
            threadHtml += messagesHtml;
        }*/
        
        //look up for images in html
        let regexp = new RegExp("src='(?<replacement>/blob/(?<threadId>[\\w-]+)/(?<blobId>[\\w-]+))'", 'gim');
        let matches = this._getMatchGroups(threadHtml, regexp);
        
        //replace blob references for images
        for(const image of matches) {
            threadHtml = await this._processFile(threadHtml, image, path, this.options.embeddedImages);
        }

        //look up for links in html
        regexp = new RegExp('href="(?<replacement>.*/blob/(?<threadId>.+)/(?<blobId>.+)\\?name=(?<fileName>.+))"', 'gim');
        matches = this._getMatchGroups(threadHtml, regexp);

        //replace blob references for links
        for(const link of matches) {
            threadHtml = await this._processFile(threadHtml, link, path);
        }

        //replace references to documents
        if(this.options.resolveReferences) {
            threadHtml = await this._resolveReferences(threadHtml, pathDeepness);
        }
  
        const wrappedHtml = this._renderDocumentHtml(threadHtml, quipThread.thread.title, path);

        this.saveCallback(wrappedHtml, sanitizeFilename(`${quipThread.thread.title.trim()}.html`), 'THREAD', path);
    }

    async _processSlidesThread(quipThread, path) {
        const blob = await this.quipService.getPdf(quipThread.thread.id);
        if(blob) {
            const fileName = sanitizeFilename(`${quipThread.thread.title.trim()}.pdf`);
            this.saveCallback(blob, fileName, "BLOB", `${path}`);
        } else {
            this.logger.warn("Can't load Slides as PDF, thread.id="  + quipThread.thread.id +
                ", thread.title=" + quipThread.thread.title +
                ", thread.type=" +  quipThread.thread.type + ", path=" +  path);
        }
    }

    async _processSpreadsheetThread(quipThread, path) {
        const blob = await this.quipService.getXlsx(quipThread.thread.id);
        if(blob) {
            const fileName = sanitizeFilename(`${quipThread.thread.title.trim()}.xlsx`);
            this.saveCallback(blob, fileName, "BLOB", `${path}`);
        } else {
            this.logger.warn("Can't load Spreadsheet as PDF, thread.id="  + quipThread.thread.id +
                ", thread.title=" + quipThread.thread.title +
                ", thread.type=" +  quipThread.thread.type + ", path=" +  path);
        }
    }

    async _processThread(quipThread, path) {
        if(!quipThread.thread) {
            const quipThreadCopy = Object.assign({}, quipThread);
            quipThreadCopy.html = '...';
            this.logger.error("quipThread.thread is not defined, thread="  + JSON.stringify(quipThreadCopy, null, 2) + ", path=" +  path);
            return;
        }

        if(['document', 'spreadsheet'].includes(quipThread.thread.type)) {
            await this._processDocumentThread(quipThread, path);
        }
        /*else if(quipThread.thread.type === 'slides') {
            this._processSlidesThread(quipThread, path);
        } else if(quipThread.thread.type === 'spreadsheet') {
            this._processSpreadsheetThread(quipThread, path);
        }*/
        else {
            this.logger.warn("Thread type is not supported, thread.id="  + quipThread.thread.id +
                ", thread.title=" + quipThread.thread.title +
                ", thread.type=" +  quipThread.thread.type + ", path=" +  path);
        }

        this.threadsProcessed++;
    }

    async _processFile(html, file, path, asImage=false) {
        const blob = await this.quipService.getBlob(file.threadId, file.blobId);
        if(blob) {
            if(asImage) {
                const imageURL = await blobImageToURL(blob);
                html = html.replace(file.replacement, imageURL);
            } else {
                let fileName;
                if(file.fileName) {
                    fileName = file.fileName.trim();
                } else {
                    fileName = `${file.blobId.trim()}.${Mime.getExtension(blob.type).trim()}`;
                }
                fileName = sanitizeFilename(fileName);

                html = html.replace(file.replacement, `blobs/${fileName}`);
                //blob.size
                this.saveCallback(blob, fileName, "BLOB", `${path}blobs`);
            }
        } else {
            this.logger.error("Can't load the file " + file.replacement + " in path = " + path);
        }

        return html;
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

    async _processFolder(quipFolder, path) {
        const threadIds = [];
        const folderIds = [];

        for(const index in quipFolder.children) {
            const quipChild = quipFolder.children[index];

            if(quipChild.thread_id) { //thread
                threadIds.push(quipChild.thread_id);
            } else if(quipChild.folder_id && !quipChild.restricted) { //folder
                folderIds.push(quipChild.folder_id);
            }
        }

        if(threadIds.length > 0) {
            const threads = await this.quipService.getThreads(threadIds);
            if(threads) {
                await this._processThreads(threads, path);
            } else {
                this.logger.error("Can't load the Child-Threads for Folder: " + path)
            }
        }

        if(folderIds.length > 0) {
            const folders = await this.quipService.getFolders(folderIds);
            if(folders) {
                await this._processFolders(folders, path);
            } else {
                this.logger.error("Can't load the Child-Folders for Folder: " + path);
            }
        }

        this.foldersProcessed++;
        this._progressReport({
            threadsProcessed: this.threadsProcessed,
            threadsTotal: this.threadsTotal,
            path: path
        });
    }

    async _countThreadsAndFolders(quipFolder, path) {
        const threadIds = [];
        const folderIds = [];

        this.referencesMap.set(quipFolder.folder.id, {
            path,
            folder: true,
            title: quipFolder.folder.title
        });

        if(!quipFolder.children || quipFolder.children.length === 0) {
            return;
        }

        const pathForChildren = `${path}${quipFolder.folder.title}/`;

        for(const index in quipFolder.children) {
            const quipChild = quipFolder.children[index];
            if(quipChild.thread_id) { //thread
                threadIds.push(quipChild.thread_id);
                    this.referencesMap.set(quipChild.thread_id, {
                        path: pathForChildren,
                    thread: true
                    });
            } else if(quipChild.folder_id) { //folder
                if (quipChild.restricted) {
                    this.logger.debug("Folder: " + pathForChildren + " has restricted child: " + quipChild.folder_id);
                } else {
                    folderIds.push(quipChild.folder_id);
                }
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
            if(!childFolders) {
                return;
            }
        }

        for(const index in childFolders) {
            await this._countThreadsAndFolders(childFolders[index], pathForChildren);
        }
    }

    async _exportFolders(folderIds) {
        this._changePhase('ANALYSIS');

        this.threadsTotal = 0;
        this.foldersTotal = 0;

        const quipFolders = await this.quipService.getFolders(folderIds);
        if(!quipFolders) {
            this._changePhase('STOP');
            this.logger.error("Can't read the root folders");
            return;
        }

        for(const index in quipFolders) {
            await this._countThreadsAndFolders(quipFolders[index], "");
        }

        this._changePhase('EXPORT');
        return this._processFolders(quipFolders, "");
    }

    _progressReport(progress) {
        this.progressCallback(progress);
    }
}

module.exports = QuipProcessor;