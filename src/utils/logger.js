const isDevelopment = process.env.NODE_ENV !== 'production';

const colors = {
    reset: '\x1b[0m',
    debug: '\x1b[36m',
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    security: '\x1b[35m'
};

const logger = {
    debug: (message, data = null) => {
        if (isDevelopment) {
            const timestamp = new Date().toISOString();
            console.log('[DEBUG ' + timestamp + ']', message);
            if (data) console.log(data);
        }
    },

    info: (message, data = null) => {
        if (isDevelopment) {
            const timestamp = new Date().toISOString();
            console.log('[INFO ' + timestamp + ']', message);
            if (data) console.log(data);
        }
    },

    warn: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.warn('[WARN ' + timestamp + ']', message);
        if (data) console.warn(data);
    },

    error: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.error('[ERROR ' + timestamp + ']', message);
        if (data) console.error(data);
    },

    security: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.log('[SECURITY ' + timestamp + ']', message);
        if (data) console.log(data);
    }
};

export default logger;
