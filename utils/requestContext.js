import { AsyncLocalStorage } from 'async_hooks';

const requestStorage = new AsyncLocalStorage();

export const runWithContext = (context, fn) => {
    try {
        if (!context.botPhoneNumberId) {
            console.error('No botPhoneNumberId in context');
            return null;
        }
        if (!context.profileId) {
            console.error('No profileId in context');
            return null;
        }
        if (!context.userMobileNumber) {
            console.error('No userMobileNumber in context');
            return null;
        }
        const validIds = ["316915674839342", "410117285518514", "608292759037444", "630734623462388"]
        if (!validIds.includes(context.botPhoneNumberId)) {
            console.error('Invalid botPhoneNumberId in context');
            return null;
        }
        return requestStorage.run(context, fn);
    } catch (error) {
        console.error('Error in runWithContext:', error);
        console.log('Falling back to running function without context');
        return fn();
    }
};

export const updateProfileIdForRequest = (profileId) => {
    const store = requestStorage.getStore();
    if (store) {
        store.profileId = profileId;
    }
};

export const getBotPhoneNumberIdForRequest = () => {
    try {
        const store = requestStorage.getStore();
        if (store?.botPhoneNumberId) {
            return store.botPhoneNumberId;
        } else {
            console.error('No botPhoneNumberId in context');
            return null;
        }
    } catch (error) {
        console.error('Error retrieving phone number ID from context:', error);
        return null;
    }
};

export const getProfileIdForRequest = () => {
    try {
        const store = requestStorage.getStore();
        if (store?.profileId) {
            return store.profileId;
        } else {
            console.error('No profileId in context');
            return null;
        }
    } catch (error) {
        console.error('Error retrieving profile ID from context:', error);
        return null;
    }
};

export const getUserMobileNumberForRequest = () => {
    try {
        const store = requestStorage.getStore();
        if (store?.userMobileNumber) {
            return store.userMobileNumber;
        } else {
            console.error('No userMobileNumber in context');
            return null;
        }
    } catch (error) {
        console.error('Error retrieving user mobile number from context:', error);
        return null;
    }
};