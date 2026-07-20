import handler from '../netlify/functions/send-nutrition-alerts.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
