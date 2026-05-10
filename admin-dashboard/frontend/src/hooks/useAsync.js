import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export const useAsync = (asyncFunction, immediate = true) => {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...params) => {
    setStatus('pending');
    setData(null);
    setError(null);

    try {
      const response = await asyncFunction(...params);
      setData(response.data?.data || response.data);
      setStatus('success');
      return response.data?.data || response.data;
    } catch (error) {
      setError(error.response?.data?.message || error.message);
      setStatus('error');
      toast.error(error.response?.data?.message || error.message);
      throw error;
    }
  }, [asyncFunction]);

  if (immediate) {
    execute();
  }

  return { execute, status, data, error };
};

export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export const usePagination = (initialPage = 1, itemsPerPage = 20) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const offset = (currentPage - 1) * itemsPerPage;

  return {
    currentPage,
    setCurrentPage,
    offset,
    itemsPerPage,
  };
};

export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};
