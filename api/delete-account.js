import handler from '../netlify/functions/delete-account.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
