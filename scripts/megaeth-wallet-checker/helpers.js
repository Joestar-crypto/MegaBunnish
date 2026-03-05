import axios from 'axios';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isRateLimited = (error) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response?.status === 429) {
    return true;
  }

  const raw = `${error.response?.data?.message ?? ''} ${error.response?.data?.result ?? ''}`.toLowerCase();
  return raw.includes('rate limit') || raw.includes('too many requests');
};

// Generic retry wrapper with exponential backoff.
export const withRetries = async (fn, retries, baseDelayMs) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }

      const multiplier = isRateLimited(error) ? 3 : 1;
      const wait = baseDelayMs * multiplier * (attempt + 1);
      await sleep(wait);
    }
  }

  throw lastError;
};

export const uniqBy = (items, keyFn) => {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }

  return out;
};
