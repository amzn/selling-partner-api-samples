const axios = require('axios');
const util = require('util');

const spApiLogger = axios.create();

// Copy over utility functions
for (const key in axios) {
    if (Object.prototype.hasOwnProperty.call(axios, key)) {
      spApiLogger[key] = axios[key];
    }
  }

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return `[Circular or non-serializable object: ${error.message}]`;
  }
}

spApiLogger.interceptors.request.use(
  (config) => {
    console.log('SP-API Outgoing request:', util.inspect({
      method: config.method.toUpperCase(),
      url: config.url,
      headers: {
        ...config.headers,
        'x-amz-access-token': '[REDACTED]' // Redact the actual token for security
      },
      params: config.params,
      data: config.data ? safeStringify(config.data) : undefined
    }, { depth: null, colors: false }));
    return config;
  },
  (error) => {
    console.error('SP-API Request error:', error);
    return Promise.reject(error);
  }
);

spApiLogger.interceptors.response.use(
  (response) => {
    console.log('SP-API Incoming response:', util.inspect({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data ? safeStringify(response.data) : undefined
    }, { depth: null, colors: false }));
    return response;
  },
  (error) => {
    console.error('SP-API Response error:', util.inspect({
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data ? safeStringify(error.response.data) : undefined
      } : null
    }, { depth: null, colors: false }));
    return Promise.reject(error);
  }
);

module.exports = spApiLogger;
