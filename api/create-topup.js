import handler from '../netlify/functions/create-topup.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
