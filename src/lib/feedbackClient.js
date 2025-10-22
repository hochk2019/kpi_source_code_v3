const TRAINING_ENDPOINT = '/api/training-resources';

const FEEDBACK_ENDPOINT = '/api/feedback';

const FEEDBACK_SUMMARY_ENDPOINT = '/api/feedback/summary';



let trainingCache = null;

let trainingCacheAt = 0;

const TRAINING_TTL = 3 * 60 * 1000;



let summaryCache = null;

let summaryCacheAt = 0;

const SUMMARY_TTL = 30 * 1000;



function handleResponse(response) {

  if (!response.ok) {

    throw new Error('Máy chủ phản hồi lỗi, vui lòng thử lại sau.');

  }

  return response.json();

}



export async function fetchTrainingResources({ forceRefresh = false } = {}) {

  const now = Date.now();

  if (!forceRefresh && trainingCache && now - trainingCacheAt < TRAINING_TTL) {

    return trainingCache;

  }

  const result = await fetch(TRAINING_ENDPOINT, {

    credentials: 'include',

  }).then(handleResponse);

  const resources = Array.isArray(result?.resources) ? result.resources : [];

  trainingCache = resources;

  trainingCacheAt = now;

  return resources;

}



export async function fetchFeedbackSummary({ forceRefresh = false } = {}) {

  const now = Date.now();

  if (!forceRefresh && summaryCache && now - summaryCacheAt < SUMMARY_TTL) {

    return summaryCache;

  }

  const result = await fetch(FEEDBACK_SUMMARY_ENDPOINT, {

    credentials: 'include',

  }).then(handleResponse);

  summaryCache = result?.summary || { total: 0, latestAt: null, averageRating: null };

  summaryCacheAt = now;

  return summaryCache;

}



export async function submitFeedback(payload) {

  const body = {

    category: payload?.category || 'khac',

    rating: payload?.rating ?? null,

    message: payload?.message || '',

    contact: payload?.contact || '',

  };

  const response = await fetch(FEEDBACK_ENDPOINT, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    credentials: 'include',

    body: JSON.stringify(body),

  });

  if (!response.ok) {

    const error = await response.json().catch(() => ({}));

    throw new Error(error?.error || 'Không thể gửi phản hồi, vui lòng thử lại.');

  }

  summaryCacheAt = 0;

  return response.json();

}



export function clearTrainingCache() {

  trainingCache = null;

  trainingCacheAt = 0;

}



export function prefetchEngagementData() {

  fetchTrainingResources().catch(() => {});

  fetchFeedbackSummary().catch(() => {});

}

