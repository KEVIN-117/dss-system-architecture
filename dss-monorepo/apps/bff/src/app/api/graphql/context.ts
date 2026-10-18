import { GraphQLError } from 'graphql';

import { authenticateRequest, type AuthenticatedRequest } from '../_lib/auth-guard';

export interface GraphQLContext {
  authentication: AuthenticatedRequest;
}

export async function createGraphQLContext(request: Request): Promise<GraphQLContext> {
  const result = await authenticateRequest(request);
  if (!result.authenticated) {
    const status = result.response.status;
    const responseBody = await result.response.clone().json().catch(() => null) as
      | { error?: string }
      | null;

    throw new GraphQLError(responseBody?.error ?? 'Authentication required', {
      extensions: {
        code: status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_SERVER_ERROR',
        http: { status },
      },
    });
  }

  return { authentication: result.value };
}
