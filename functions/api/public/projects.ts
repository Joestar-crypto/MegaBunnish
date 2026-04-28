import {
  getEcosystemSummary,
  listEvents,
  listProjects,
  publicJsonResponse,
  type PublicQuery
} from '../../../api/_public';

type FunctionContext = {
  request: Request;
};

function queryFromUrl(url: URL): PublicQuery {
  const result: PublicQuery = {};
  url.searchParams.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  });
  return result;
}

export function onRequestGet({ request }: FunctionContext) {
  const url = new URL(request.url);
  return publicJsonResponse(listProjects(queryFromUrl(url)));
}

export function onRequestOptions() {
  return publicJsonResponse({}, 204);
}

export { getEcosystemSummary, listEvents };
