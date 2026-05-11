/**
 * Shared utility functions for Cloudflare Pages Functions
 */

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Fetch video title from YouTube Data API
 * @param {string} videoUrl - YouTube video URL
 * @param {string} apiKey - YouTube API key
 * @returns {Promise<string|null>} Video title or null if not found
 */
export async function fetchVideoTitle(videoUrl, apiKey) {
  if (!apiKey) {
    return null;
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return null;
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.title;
    }
  } catch (error) {
    console.error('Error fetching video title:', error);
  }

  return null;
}

/**
 * Get available subtitle tracks for a video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Array>} Array of available subtitle tracks
 */
async function getAvailableCaptions(videoId) {
  try {
    const url = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const xmlText = await response.text();

    // Parse available caption tracks
    const tracks = [];
    const trackMatches = xmlText.matchAll(/<track[^>]*>/g);

    for (const match of trackMatches) {
      const trackTag = match[0];
      const langCodeMatch = trackTag.match(/lang_code="([^"]+)"/);
      const kindMatch = trackTag.match(/kind="([^"]+)"/);

      if (langCodeMatch) {
        tracks.push({
          langCode: langCodeMatch[1],
          kind: kindMatch ? kindMatch[1] : '',
        });
      }
    }

    return tracks;
  } catch (error) {
    console.error('Error fetching caption list:', error);
    return [];
  }
}

/**
 * Fetch subtitles from YouTube timedtext API
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Language code (e.g., 'ja', 'en')
 * @returns {Promise<Array>} Array of subtitle segments
 */
export async function fetchSubtitles(videoId, lang = 'ja') {
  try {
    // Get available captions
    const availableTracks = await getAvailableCaptions(videoId);

    if (availableTracks.length === 0) {
      console.log(`No captions available for video ${videoId}`);
      return null;
    }

    // Find matching language (prefer manual over auto-generated)
    let selectedTrack = availableTracks.find(t => t.langCode === lang && !t.kind);
    if (!selectedTrack) {
      selectedTrack = availableTracks.find(t => t.langCode === lang);
    }
    if (!selectedTrack) {
      console.log(`No ${lang} captions found for video ${videoId}`);
      console.log('Available:', availableTracks.map(t => t.langCode).join(', '));
      return null;
    }

    // Fetch subtitle content
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedTrack.langCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const xmlText = await response.text();

    // Parse XML and extract text segments
    const segments = [];
    const textMatches = xmlText.matchAll(/<text[^>]*>(.*?)<\/text>/g);

    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (text) {
        segments.push(text);
      }
    }

    return segments;
  } catch (error) {
    console.error(`Error fetching ${lang} subtitles:`, error);
    return null;
  }
}

/**
 * Detect if text is primarily Japanese
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be Japanese
 */
function isJapanese(text) {
  // Count hiragana, katakana, and CJK characters
  const jpChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length;
  // Count Latin characters
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;

  return jpChars > enChars;
}

/**
 * Pair Japanese and English subtitle segments
 * @param {Array} jaSegments - Japanese segments
 * @param {Array} enSegments - English segments
 * @returns {Array} Array of {jp, en} pairs
 */
export function pairSubtitles(jaSegments, enSegments) {
  const pairs = [];
  let jaIndex = 0;
  let enIndex = 0;

  while (jaIndex < jaSegments.length && enIndex < enSegments.length) {
    const jaSeg = jaSegments[jaIndex];
    const enSeg = enSegments[enIndex];

    // Verify language detection
    if (isJapanese(jaSeg) && !isJapanese(enSeg)) {
      pairs.push({
        jp: jaSeg,
        en: enSeg,
      });
      jaIndex++;
      enIndex++;
    } else if (isJapanese(jaSeg)) {
      // Skip if Japanese followed by Japanese
      jaIndex++;
    } else {
      // Skip if English followed by English
      enIndex++;
    }
  }

  return pairs;
}

/**
 * Fetch latest videos from a YouTube channel
 * @param {string} channelHandle - Channel handle (e.g., '@englishinthelounge')
 * @param {string} apiKey - YouTube API key
 * @param {number} maxResults - Max number of videos to fetch
 * @returns {Promise<Array>} Array of {videoId, title, url}
 */
export async function fetchChannelVideos(channelHandle, apiKey, maxResults = 10) {
  try {
    // Remove @ if present
    const handle = channelHandle.replace('@', '');

    // Get channel ID from handle
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forHandle=${handle}&key=${apiKey}`;
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      console.error('Channel not found:', channelHandle);
      return [];
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Get videos from uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`;
    const playlistResponse = await fetch(playlistUrl);
    const playlistData = await playlistResponse.json();

    if (!playlistData.items) {
      return [];
    }

    return playlistData.items.map(item => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
    }));
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    return [];
  }
}
