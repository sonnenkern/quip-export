function mockResolvedWithThen(func, resolveValue) {
    if(!func._isMockFunction) throw "First parameter is not a mock function!";
    func.promiseCalledWithThenTimes = 0;
    class PromiseMock extends Promise {
        constructor(executor) {
            super(executor);
        }

        then(onFulfilled, onRejected) {
            func.promiseCalledWithThenTimes++;
            return super.then(onFulfilled, onRejected);
        }
    }

    func.mockImplementation(() => PromiseMock.resolve(resolveValue));
}

module.exports = {mockResolvedWithThen};