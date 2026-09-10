import handler from '../netlify/functions/keep-alive.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
