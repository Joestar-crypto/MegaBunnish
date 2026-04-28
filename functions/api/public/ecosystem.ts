import { getEcosystemSummary, publicJsonResponse } from '../../../api/_public';

export function onRequestGet() {
  return publicJsonResponse(getEcosystemSummary());
}

export function onRequestOptions() {
  return publicJsonResponse({}, 204);
}
