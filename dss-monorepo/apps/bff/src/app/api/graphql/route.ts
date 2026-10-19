import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';

import { createGraphQLContext, type GraphQLContext } from './context';
import { withCors } from '../../../lib/cors';
import { analyticsTypeDefs, createAnalyticsResolvers } from './analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const analyticsResolvers = createAnalyticsResolvers();

const server = new ApolloServer<GraphQLContext>({
  typeDefs: `#graphql
    type Query {
      ping: String!
    }
  ` + analyticsTypeDefs,
  resolvers: {
    ...analyticsResolvers,
    Query: {
      ...analyticsResolvers.Query,
      ping: () => 'pong',
    },
  },
});

const apolloHandler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: createGraphQLContext,
});

async function handleGraphQL(request: NextRequest): Promise<Response> {
  return withCors(request, await apolloHandler(request));
}

export const GET = handleGraphQL;
export const POST = handleGraphQL;
