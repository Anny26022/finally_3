import { useRef, useCallback, useEffect } from 'react';

interface XirrCalculationRequest {
  id: string;
  startDate: Date;
  startingCapital: number;
  endDate: Date;
  endingCapital: number;
  capitalChanges: { date: Date; amount: number }[];
}

interface XirrCalculationResponse {
  id: string;
  result: number;
  error?: string;
}

type XirrCallback = (result: number, error?: string) => void;

export function useXirrWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, XirrCallback>>(new Map());
  const requestIdRef = useRef(0);

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker from the worker file
      workerRef.current = new Worker(
        new URL('../workers/xirrCalculations.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (e: MessageEvent<XirrCalculationResponse>) => {
        const { id, result, error } = e.data;
        const callback = callbacksRef.current.get(id);
        
        if (callback) {
          callback(result, error);
          callbacksRef.current.delete(id);
        }
      };

      workerRef.current.onerror = (error) => {
        // Debug logging removed for production
        // Fallback to synchronous calculation if worker fails
      };
    } catch (error) {
      // Debug logging removed for production
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const calculateXirr = useCallback((
    startDate: Date,
    startingCapital: number,
    endDate: Date,
    endingCapital: number,
    capitalChanges: { date: Date; amount: number }[],
    callback: XirrCallback
  ) => {
    if (!workerRef.current) {
      // Fallback to synchronous calculation
      // Import and use the original calcXIRR function
      import('../lib/calculations').then(({ calcXIRR }) => {
        try {
          const result = calcXIRR(startDate, startingCapital, endDate, endingCapital, capitalChanges);
          callback(result);
        } catch (error) {
          callback(0, error instanceof Error ? error.message : 'Calculation error');
        }
      });
      return;
    }

    const id = `xirr_${++requestIdRef.current}`;
    callbacksRef.current.set(id, callback);

    const request: XirrCalculationRequest = {
      id,
      startDate,
      startingCapital,
      endDate,
      endingCapital,
      capitalChanges
    };

    workerRef.current.postMessage(request);
  }, []);

  const calculateXirrSync = useCallback((
    startDate: Date,
    startingCapital: number,
    endDate: Date,
    endingCapital: number,
    capitalChanges: { date: Date; amount: number }[]
  ): Promise<number> => {
    return new Promise((resolve, reject) => {
      calculateXirr(
        startDate,
        startingCapital,
        endDate,
        endingCapital,
        capitalChanges,
        (result, error) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }
        }
      );
    });
  }, [calculateXirr]);

  return {
    calculateXirr,
    calculateXirrSync,
    isWorkerSupported: !!workerRef.current
  };
}
