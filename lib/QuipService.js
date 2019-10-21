const fetch = require('node-fetch');

function timeConverter(UNIX_timestamp){
    const a = new Date(UNIX_timestamp * 1000);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    const min = a.getMinutes();
    const sec = a.getSeconds();
    const time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

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
        //await new Promise(done => setTimeout(done, 500));
        this.stats.query_count++;
        const res = await fetch(`${this.apiURL}${url}`, this._getOptions(method));
        //console.log("STATUS: ", res.status);
        //console.log("LIMIT: ", res.headers.get('x-ratelimit-reset'));
        //console.log("TIME: ", timeConverter(res.headers.get('x-ratelimit-reset')));
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