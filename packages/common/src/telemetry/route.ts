const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const OBJECT_ID_RE = /\/[0-9a-f]{24}(?=\/|$)/gi;
const NUMERIC_RE = /\/\d+(?=\/|$)/g;

/**
 * Turns a concrete request URL into a low-cardinality route label, e.g.
 *   /conversations/6f1c...-uuid/messages?limit=5  ->  /conversations/:id/messages
 *
 * Requests that matched no route (scanners, typos) collapse into "unmatched"
 * so they cannot explode metric cardinality.
 */
export const resolveRouteLabel = (
  originalUrl: string,
  routeMatched: boolean,
  statusCode: number,
): string => {
  if (!routeMatched && statusCode === 404) {
    return 'unmatched';
  }

  const path = originalUrl.split('?')[0] || '/';
  return path.replace(UUID_RE, ':id').replace(OBJECT_ID_RE, '/:id').replace(NUMERIC_RE, '/:n');
};
