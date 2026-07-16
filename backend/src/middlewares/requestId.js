/**
 * Request correlation id (Module 18).
 *
 * Attaches a stable id to every request, echoes it back as `X-Request-Id`, and
 * exposes it on `req.id` so logs and error responses can be tied to a single
 * request when debugging a production incident. An id supplied by an upstream
 * proxy/load balancer is preserved so the trace spans the whole hop chain.
 */
import { randomUUID } from 'node:crypto';

const HEADER = 'X-Request-Id';
/** Guard against a hostile upstream stuffing junk into our logs. */
const MAX_LENGTH = 128;
const SAFE = /^[\w.:-]+$/;

export default function requestId(req, res, next) {
  const inbound = req.get(HEADER);
  req.id = inbound && inbound.length <= MAX_LENGTH && SAFE.test(inbound) ? inbound : randomUUID();
  res.setHeader(HEADER, req.id);
  next();
}
