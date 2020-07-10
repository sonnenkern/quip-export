const fetch = require('node-fetch');
const LoggerAdapter = require('./common/LoggerAdapter');

const TIMES_LIMIT_503 = 10;

class QuipService {
    constructor(accessToken, apiURL='https://platform.quip.com:443/1') {
        this.accessToken = accessToken;
        this.apiURL = apiURL;
        this.logger = new LoggerAdapter();
        this.querries503 = new Map();
        this.stats = {
            query_count: 0,
            getThread_count: 0,
            getThreads_count: 0,
            getFolder_count: 0,
            getFolders_count: 0,
            getBlob_count: 0,
            getPdf_count: 0,
            getXlsx_count: 0,
            getDocx_count: 0,
            getCurrentUser_count: 0,
            getThreadMessages_count: 0,
            getUser_count: 0
        };
    }

    setLogger(logger) {
        this.logger = logger;
    }

    async checkUser() {
        this.stats.getCurrentUser_count++;

        const res = await fetch(`${this.apiURL}/users/current`, this._getOptions('GET'));
        if(res.ok) return true;

        return false;
    }

    async getUser(userIds) {
        this.stats.getUser_count++;
        return this._apiCall(`/users/${userIds}`);
    }

    async getCurrentUser() {
        this.stats.getCurrentUser_count++;
        return this._apiCall('/users/current');
    }

    async getFolder(folderId) {
        this.stats.getFolder_count++;
        return this._apiCall(`/folders/${folderId}`);
    }

    async getThread(threadId) {
        this.stats.getThread_count++;
        return this._apiCall(`/threads/${threadId}`);
    }

    async getThreadMessages(threadId) {
        this.stats.getThreadMessages_count++;
        return this._apiCall(`/messages/${threadId}`);
    }

    async getThreads(threadIds) {
        this.stats.getThreads_count++;
        return this._apiCall(`/threads/?ids=${threadIds}`);
    }

    async getFolders(threadIds) {
        this.stats.getFolders_count++;
        return this._apiCall(`/folders/?ids=${threadIds}`);
    }

    async getBlob(threadId, blobId) {
        //const random = (Math.random() > 0.8) ? 'random' : '';
        this.stats.getBlob_count++;
        return this._apiCallBlob(`/blob/${threadId}/${blobId}`);
    }

    async getPdf(threadId) {
        this.stats.getPdf_count++;
        return this._apiCallBlob(`/threads/${threadId}/export/pdf`);
    }

    async getDocx(threadId) {
        this.stats.getDocx_count++;
        return this._apiCallBlob(`/threads/${threadId}/export/docx`);
    }

    async getXlsx(threadId) {
        this.stats.getXlsx_count++;
        return this._apiCallBlob(`/threads/${threadId}/export/xlsx`);
    }

    async _apiCallBlob(url, method = 'GET') {
        this.stats.query_count++;

        try {
            const res = await fetch(`${this.apiURL}${url}`, this._getOptions(method));
            if(!res.ok) {
                if(res.status === 503) {
                    const waitingInMs = res.headers.get('x-ratelimit-reset')*1000 - new Date().getTime();
                    this.logger.debug(`HTTP 503: for ${url}, waiting in ms: ${waitingInMs}`);
                    if(this._check503Query(url)) {
                        return new Promise(resolve => setTimeout(() => {
                            resolve(this._apiCallBlob(url, method));
                        }, waitingInMs));
                    } else {
                        this.logger.error(`Couldn't fetch ${url}, tryed to get it ${TIMES_LIMIT_503} times`);
                        return;
                    }
                } else {
                    this.logger.debug(`Couldn't fetch ${url}, received ${res.status}`);
                    return;
                }
            }

            this.querries503.delete(url);

            return res.blob();
        } catch (e) {
            this.logger.error(`Couldn't fetch ${url}, `, e);
        }
    }

    async _apiCall(url, method = 'GET') {
        this.stats.query_count++;

        try {
            const res = await fetch(`${this.apiURL}${url}`, this._getOptions(method));
            if(!res.ok) {
                if(res.status === 503) {
                    const waitingInMs = res.headers.get('x-ratelimit-reset')*1000 - new Date().getTime();
                    this.logger.debug(`HTTP 503: for ${url}, waiting in ms: ${waitingInMs}`);
                    if(this._check503Query(url)) {
                        return new Promise(resolve => setTimeout(() => {
                            resolve(this._apiCall(url, method));
                        }, waitingInMs));
                    } else {
                        this.logger.error(`Couldn't fetch ${url}, tryed to get it ${TIMES_LIMIT_503} times`);
                        return;
                    }
                } else {
                    this.logger.debug(`Couldn't fetch ${url}, received ${res.status}`);
                    return;
                }
            }

            return res.json();
        } catch (e) {
            this.logger.error(`Couldn't fetch ${url}, `, e);
        }
    }

    _check503Query(url) {
        let count = this.querries503.get(url);
        if(!count) {
            count = 0;
        }

        this.querries503.set(url, ++count);
        if(count > TIMES_LIMIT_503) {
            return false;
        }

        return true;
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