/**
 * API Client for Cloudflare D1 backend
 */

const API_BASE = import.meta.env.DEV ? 'http://localhost:8788' : '';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Videos API
export const videosAPI = {
  async getAll() {
    return fetchAPI('/api/videos');
  },

  async getTitle(url) {
    const params = new URLSearchParams({ url });
    return fetchAPI(`/api/video-title?${params}`);
  },
};

// Sentences API
export const sentencesAPI = {
  async getAll(videoId = null) {
    const params = videoId ? `?video_id=${videoId}` : '';
    return fetchAPI(`/api/sentences${params}`);
  },

  async create(sentences) {
    return fetchAPI('/api/sentences', {
      method: 'POST',
      body: JSON.stringify(sentences),
    });
  },

  async update(sentence) {
    return fetchAPI('/api/sentences', {
      method: 'PUT',
      body: JSON.stringify(sentence),
    });
  },

  async delete(id) {
    return fetchAPI(`/api/sentences?id=${id}`, {
      method: 'DELETE',
    });
  },
};

// Feedback API
export const feedbackAPI = {
  async compare({ jp, userAnswer, correctAnswer }) {
    return fetchAPI('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ jp, userAnswer, correctAnswer }),
    });
  },
};

// Sessions API
export const sessionsAPI = {
  async getAll() {
    return fetchAPI('/api/sessions');
  },

  async create(session) {
    return fetchAPI('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  },
};

// Migration helper: Import data from localStorage to D1
export async function migrateFromLocalStorage(localData) {
  try {
    // 1. Import sentences (and auto-create videos)
    if (localData.sentences && localData.sentences.length > 0) {
      await sentencesAPI.create(localData.sentences);
    }

    // 2. Import sessions
    if (localData.sessions && localData.sessions.length > 0) {
      for (const session of localData.sessions) {
        await sessionsAPI.create(session);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}
