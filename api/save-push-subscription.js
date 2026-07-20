import handler from '../netlify/functions/save-push-subscription.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
