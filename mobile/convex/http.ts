import { httpRouter } from 'convex/server';

import { auth } from './auth';
import { confirmRoute, joinRoute, leaveRoute, preflight } from './waitlist';

const http = httpRouter();

auth.addHttpRoutes(http);

// The launch waitlist page in `waitlist/`.
for (const [path, handler] of [
  ['/waitlist/join', joinRoute],
  ['/waitlist/confirm', confirmRoute],
  ['/waitlist/leave', leaveRoute],
] as const) {
  http.route({ path, method: 'POST', handler });
  http.route({ path, method: 'OPTIONS', handler: preflight });
}

export default http;
