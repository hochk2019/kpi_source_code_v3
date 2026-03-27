import { useCallback, useEffect, useRef, useState } from 'react';

const EMPTY_ARGS = Object.freeze([]);



/**

 * Hook chuẩn hóa luồng gọi API bất đồng bộ với trạng thái loading/error thống nhất.

 * @param {(context: { signal: AbortSignal }, ...args: any[]) => Promise<any>} task

 * @param {{

 *   initialData?: any,

 *   immediate?: boolean,

 *   initialArgs?: any[],

 *   onSuccess?: (result: any) => void,

 *   onError?: (error: unknown) => void,

 *   throwOnError?: boolean,

 * }} [options]

 */

export default function useAsyncRequest(task, options = {}) {

  const {

    initialData = null,

    immediate = false,

    initialArgs = EMPTY_ARGS,

    onSuccess,

    onError,

    throwOnError = false,

  } = options;



  const mountedRef = useRef(true);

  const abortRef = useRef(null);

  const onSuccessRef = useRef(onSuccess);

  const onErrorRef = useRef(onError);



  const [data, setData] = useState(initialData);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {

    onSuccessRef.current = onSuccess;

  }, [onSuccess]);

  useEffect(() => {

    onErrorRef.current = onError;

  }, [onError]);



  const execute = useCallback(

    async (...args) => {

      if (typeof task !== 'function') {

        console.warn('useAsyncRequest: task không hợp lệ');

        return undefined;

      }



      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;



      if (mountedRef.current) {

        setLoading(true);

        setError('');

      }



      try {

        const result = await task({ signal: controller.signal }, ...args);

        if (!mountedRef.current) return result;



        setData(result);

        setError('');

        onSuccessRef.current?.(result);

        return result;

      } catch (err) {

        if (err?.name === 'AbortError') {

          return undefined;

        }

        const message = err?.message || 'Đã xảy ra lỗi không xác định';

        if (mountedRef.current) {

          setError(message);

        }

        onErrorRef.current?.(err);

        if (throwOnError) {

          throw err;

        }

        return undefined;

      } finally {

        if (mountedRef.current) {

          setLoading(false);

        }

        if (abortRef.current === controller) {

          abortRef.current = null;

        }

      }

    },

    [task, throwOnError]

  );



  useEffect(() => {

    mountedRef.current = true;

    return () => {

      mountedRef.current = false;

      abortRef.current?.abort();

      abortRef.current = null;

    };

  }, []);

  useEffect(() => {

    if (immediate) {

      execute(...initialArgs);

    }

  }, [execute, immediate, initialArgs]);



  const reset = useCallback(() => {

    abortRef.current?.abort();

    abortRef.current = null;

    if (!mountedRef.current) return;

    setLoading(false);

    setError('');

    setData(initialData);

  }, [initialData]);



  return {

    data,

    setData,

    loading,

    error,

    execute,

    reset,

  };

}

