import handler from '../netlify/functions/validate-voucher.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
