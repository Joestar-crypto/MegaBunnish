import { getEcosystemSummary, listEvents, listProjects, publicJsonHeaders, type PublicQuery } from './_public';

type ApiRequest = {
  method?: string;
  query?: PublicQuery;
};

type ApiResponse = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
};

type Resource = 'projects' | 'events' | 'ecosystem';

function applyHeaders(response: ApiResponse) {
  for (const [name, value] of Object.entries(publicJsonHeaders())) {
    if (name === 'Content-Type') continue;
    response.setHeader(name, value);
  }
}

export function handlePublicRequest(resource: Resource, request: ApiRequest, response: ApiResponse) {
  applyHeaders(response);
  response.setHeader('Allow', 'GET,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).json({});
    return;
  }

  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const query = request.query ?? {};

  switch (resource) {
    case 'projects':
      response.status(200).json(listProjects(query));
      return;
    case 'events':
      response.status(200).json(listEvents(query));
      return;
    case 'ecosystem':
      response.status(200).json(getEcosystemSummary());
      return;
    default:
      response.status(404).json({ error: 'Unknown public resource.' });
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  // The Node entrypoint calls this only when the resource cannot be inferred.
  // It returns a tiny index describing the available endpoints.
  applyHeaders(response);
  if (request.method && request.method !== 'GET' && request.method !== 'OPTIONS') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.status(204).json({});
    return;
  }

  response.status(200).json({
    name: 'MegaBunnish public API',
    version: 1,
    endpoints: {
      projects: '/api/public/projects',
      events: '/api/public/events',
      ecosystem: '/api/public/ecosystem'
    },
    docs: 'https://github.com/holgu/megabunnish/blob/main/docs/MEGAETH.md'
  });
}
