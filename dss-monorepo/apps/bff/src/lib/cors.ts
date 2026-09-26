import { getAllowedOrigins } from './bff-config';

export function withCors<T extends Response>(request: Request, response: T): T {
  const origin = request.headers.get('origin');
  if (!origin || !getAllowedOrigins().includes(origin)) {
    return response;
  }

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Vary', 'Origin');
  return response;
}
