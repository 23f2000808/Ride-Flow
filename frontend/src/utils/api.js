import apiClient from './apiClient';

export const apiFetch = async (endpoint, options = {}) => {
  const requestData =
    typeof options.body === 'string' ? JSON.parse(options.body) : options.body;

  try {
    const response = await apiClient({
      url: endpoint,
      method: options.method || 'get',
      data: requestData,
      headers: options.headers,
      signal: options.signal,
    });

    return response.data;
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
      throw error;
    }

    const message = error?.response?.data?.message || error?.message || 'Request failed.';
    const wrappedError = new Error(message);
    wrappedError.status = error?.response?.status;
    wrappedError.data = error?.response?.data;
    wrappedError.cause = error;
    throw wrappedError;
  }
};

export default apiClient;
