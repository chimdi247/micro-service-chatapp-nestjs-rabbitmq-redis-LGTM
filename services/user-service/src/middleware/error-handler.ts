import { HttpError, recordActiveSpanError } from '@chatapp/common';

import type { ErrorRequestHandler } from 'express';
import { logger } from '@/utils/logger';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  recordActiveSpanError(err);

  // Expected client errors (4xx HttpError) are warnings; everything else is a real failure.
  if (err instanceof HttpError && err.statusCode < 500) {
    logger.warn({ err, status_code: err.statusCode }, 'Request failed with client error');
  } else {
    logger.error({ err }, 'Unhandled error occurred');
  }

  const error = err instanceof HttpError ? err : undefined;
  const statusCode = error?.statusCode ?? 500;
  const message = statusCode >= 500 ? 'Internal Server Error' : (error?.message ?? 'Unknown Error');
  const payload = error?.details ? { message, details: error.details } : { message };

  res.status(statusCode).json(payload);

  void _next();
};
