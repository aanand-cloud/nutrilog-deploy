import handler from '../netlify/functions/create-subscription.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
