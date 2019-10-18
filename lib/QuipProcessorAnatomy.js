const QuipProcessor =  require('./QuipProcessor');

class QuipProcessorAnatomy extends QuipProcessor{

    constructor (quipToken, saveCallback, progressCallback, options) {
        super(quipToken, saveCallback, progressCallback, options);
    }

    async processAnatomyFolders(anatomyFolders, path) {
        const promises = [];
        for(let index in anatomyFolders) {
            promises.push(this.processAnatomyFolder(anatomyFolders[index], `${path}${anatomyFolders[index].folder.title}/`));
        }
        await Promise.all(promises);
    }

    async processAnatomyFolder(anatomyFolder, path) {
        if(anatomyFolder.threadIds.length > 0) {
            await
                this.processThreads(await this.quipService.getThreads(anatomyFolder.threadIds), path);
        }

        if(anatomyFolder.folderIds.length > 0) {
            await
                this.processAnatomyFolders(anatomyFolder.folders, path);
        }

        this.foldersProcessed++;

        this.progressFolder(path);
    }

    async readFolderAnatomy(quipFolder) {
        quipFolder.threadsTotal = 0;
        quipFolder.foldersTotal = 0;
        quipFolder.threadIds = [];
        quipFolder.folderIds = [];

        for(let index in quipFolder.children) {
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

        this.progressReport("Folders analyse...", "", `Folders: ${this.foldersTotal}, Threads: ${this.threadsTotal}`);

        quipFolder.folders = [];

        if(quipFolder.folderIds.length > 0) {
            quipFolder.folders = await this.quipService.getFolders(quipFolder.folderIds);
        }

        for(let index in quipFolder.folders) {
            const childFolderAnatomy = await this.readFolderAnatomy(quipFolder.folders[index]);
            quipFolder.threadsTotal += childFolderAnatomy.threadsTotal;
            quipFolder.foldersTotal += childFolderAnatomy.foldersTotal
        }

        return quipFolder;
    }

    async exportFolders(folderIds) {
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

        for(let index in folderIds) {
            const folderAnatomy = await this.readFolderAnatomy(await this.quipService.getFolder(folderIds[index]));
            anatomy.threadsTotal += folderAnatomy.threadsTotal;
            anatomy.foldersTotal += folderAnatomy.foldersTotal;
            anatomy.folders[folderIds[index]] = folderAnatomy;
        }

        console.log('***************', this.threadsTotal, this.foldersTotal);

        //console.log(JSON.stringify(anatomy, null, 2));

        return this.processAnatomyFolder(anatomy, "");
    }
}

module.exports = QuipProcessorAnatomy;