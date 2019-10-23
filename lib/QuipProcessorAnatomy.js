const QuipProcessor =  require('./QuipProcessor');

class QuipProcessorAnatomy extends QuipProcessor{

    constructor (quipToken, saveCallback, progressCallback, phaseCallback, options) {
        super(quipToken, saveCallback, progressCallback, phaseCallback, options);
    }

    async _processAnatomyFolders(anatomyFolders, path) {
        const promises = [];
        for(const index in anatomyFolders) {
            promises.push(this._processAnatomyFolder(anatomyFolders[index], `${path}${anatomyFolders[index].folder.title}/`));
        }
        await Promise.all(promises);
    }

    async _processAnatomyFolder(anatomyFolder, path) {
        if(anatomyFolder.threadIds.length > 0) {
            await
                this._processThreads(await this.quipService.getThreads(anatomyFolder.threadIds), path);
        }

        if(anatomyFolder.folderIds.length > 0) {
            await
                this._processAnatomyFolders(anatomyFolder.folders, path);
        }

        this.foldersProcessed++;

        this.progressFolder(path);
    }

    async _readFolderAnatomy(quipFolder) {
        quipFolder.threadsTotal = 0;
        quipFolder.foldersTotal = 0;
        quipFolder.threadIds = [];
        quipFolder.folderIds = [];

        for(const index in quipFolder.children) {
            const quipChild = quipFolder.children[index];
            if(quipChild.thread_id) { //thread
                quipFolder.threadIds.push(quipChild.thread_id);
                quipFolder.threadsTotal++;
            } else if(quipChild.folder_id) { //folder
                quipFolder.folderIds.push(quipChild.folder_id);
                quipFolder.foldersTotal++;
            }
        }

        this.threadsTotal += quipFolder.threadIds.length;
        this.foldersTotal += quipFolder.folderIds.length;

        this._progressReport({
            readFolders: this.foldersTotal,
            readThreads: this.threadsTotal
        });

        if(quipFolder.folderIds.length > 0) {
            quipFolder.folders = await this.quipService.getFolders(quipFolder.folderIds);
        }

        for(const index in quipFolder.folders) {
            const childFolderAnatomy = await this._readFolderAnatomy(quipFolder.folders[index]);
            quipFolder.threadsTotal += childFolderAnatomy.threadsTotal;
            quipFolder.foldersTotal += childFolderAnatomy.foldersTotal;
        }

        return quipFolder;
    }

    async _exportFolders(folderIds) {
        this._changePhase('ANALYSE');

        const anatomy = {
            folders: {},
            folderIds: folderIds,
            threadIds: [],
            threadsTotal: 0,
            foldersTotal: 0,
            folder: {
                id: "ROOT"
            }
        };

        for(const index in folderIds) {
            const folderAnatomy = await this._readFolderAnatomy(await this.quipService.getFolder(folderIds[index]));
            anatomy.threadsTotal += folderAnatomy.threadsTotal;
            anatomy.foldersTotal += folderAnatomy.foldersTotal;
            anatomy.folders[folderIds[index]] = folderAnatomy;
        }

        this._changePhase('EXPORT');

        return this._processAnatomyFolder(anatomy, "");
    }
}

module.exports = QuipProcessorAnatomy;