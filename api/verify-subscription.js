import handler from '../netlify/functions/verify-subscription.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
