import handler from '../netlify/functions/create-billing-portal.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
