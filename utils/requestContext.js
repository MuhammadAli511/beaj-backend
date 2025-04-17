import { AsyncLocalStorage } from 'async_hooks';

const requestStorage = new AsyncLocalStorage();

export const runWithContext = (context, fn) => {
    return requestStorage.run(context, fn);
};


export const getPhoneNumberIdForRequest = () => {
    const store = requestStorage.getStore();
    return store?.botPhoneNumberId;
}; 