import { AsyncLocalStorage } from 'async_hooks';

const requestStorage = new AsyncLocalStorage();
const defaultPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

export const runWithContext = (context, fn) => {
    return requestStorage.run(context, fn);
};


export const getPhoneNumberIdForRequest = () => {
    const store = requestStorage.getStore();
    return store?.botPhoneNumberId || defaultPhoneNumberId;
}; 