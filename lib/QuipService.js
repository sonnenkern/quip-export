const fetch = require('node-fetch');

class QuipService {
    constructor(accessToken, apiURL='https://platform.quip.com:443/1') {
        this.accessToken = accessToken;
        this.apiURL = apiURL;
        this.stats = {
            query_count: 0,
            getThreads_count: 0,
            getFolder_count: 0,
            getFolders_count: 0,
            getBlob_count: 0,
            getUser_count: 0
        };
    }

    getUser() {
        this.stats.getUser_count++;
        return this._apiCall('/users/current');
    }

    getFolder(folderId) {
        this.stats.getFolder_count++;
        return this._apiCall(`/folders/${folderId}`);
    }

    getThread(threadId) {
        return this._apiCall(`/threads/${threadId}`);
    }

    getThreads(threadIds) {
        this.stats.getThreads_count++;
        return this._apiCall(`/threads/?ids=${threadIds}`);
    }

    getFolders(threadIds) {
        this.stats.getFolders_count++;
        return this._apiCall(`/folders/?ids=${threadIds}`);
    }

    getBlob(threadId, blobId) {
        this.stats.getBlob_count++;
        return this._apiCallBlob(`/blob/${threadId}/${blobId}`);
    }

    async _apiCallBlob(url, method = 'GET') {
        this.stats.query_count++;
        const res = await fetch(`${this.apiURL}${url}`, this._getOptions(method));
        if(!res.ok) {
            throw new Error(`Couldn't fetch ${url}, received ${res.status}`);
        }

        return res.blob();
    }

    async _apiCall(url, method = 'GET') {
        this.stats.query_count++;
        const res = await fetch(`${this.apiURL}${url}`, this._getOptions(method));
        if(!res.ok) {
            throw new Error(`Couldn't fetch ${url}, received ${res.status}`);
        }

        return res.json();
    }


    _getOptions(method) {
        return {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + this.accessToken,
                'Content-Type': 'application/json'
            }
        };
    }
}

module.exports = QuipService;