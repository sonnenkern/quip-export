function promiseCalledWithThen(obj, resolveValue) {
    if(!obj._isMockFunction) throw "First parameter is not a mock function!";
    obj.promiseCalledWithThen = false;
    let promise = new Promise(((resolve) => {
        resolve(resolveValue);
    }));
    promise.then = function(onResolved, onRejected) {
        obj.promiseCalledWithThen = true;
        return Promise.prototype.then.call(Promise.prototype.then.call(this, onResolved, onRejected));
    };
    obj.mockImplementation(() => promise);
}

module.exports = {promiseCalledWithThen};