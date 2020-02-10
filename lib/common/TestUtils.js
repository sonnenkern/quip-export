function mockResolvedWithThen(func, resolveValue) {
    if(!func._isMockFunction) throw "First parameter is not a mock function!";
    func.promiseCalledWithThenTimes = 0;
    let promise = new Promise(((resolve) => {
        resolve(resolveValue);
    }));
    promise.then = function(onResolved, onRejected) {
        func.promiseCalledWithThenTimes++;
        return Promise.prototype.then.call(Promise.prototype.then.call(this, onResolved, onRejected));
    };
    func.mockImplementation(() => promise);
}

module.exports = {mockResolvedWithThen};