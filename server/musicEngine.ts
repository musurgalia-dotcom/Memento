import { GoogleGenAI } from '@google/genai';

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
}

const MOOD_QUERY_MAP: Record<string, { query: string; tempoFeel: string; energy: number }> = {
  dreamy: { query: 'dream pop ambient indie', tempoFeel: 'floating', energy: 0.75 },
  мечтательн: { query: 'dream pop ambient indie', tempoFeel: 'floating', energy: 0.75 },
  nostalgic: { query: 'indie folk acoustic warm', tempoFeel: 'unhurried', energy: 0.82 },
  ностальг: { query: 'indie folk acoustic warm', tempoFeel: 'unhurried', energy: 0.82 },
  calm: { query: 'solo piano ambient calm', tempoFeel: 'still', energy: 0.68 },
  спокойн: { query: 'solo piano ambient calm', tempoFeel: 'still', energy: 0.68 },
  тишин: { query: 'solo piano ambient calm', tempoFeel: 'still', energy: 0.68 },
  peaceful: { query: 'solo piano ambient peaceful', tempoFeel: 'still', energy: 0.68 },
  energetic: { query: 'upbeat synth pop indie dance', tempoFeel: 'brisk', energy: 1.25 },
  энергич: { query: 'upbeat synth pop indie dance', tempoFeel: 'brisk', energy: 1.25 },
  carefree: { query: 'sunny indie folk upbeat', tempoFeel: 'bright', energy: 1.15 },
  romantic: { query: 'soft jazz acoustic ballad', tempoFeel: 'swaying', energy: 0.85 },
  романтич: { query: 'soft jazz acoustic ballad', tempoFeel: 'swaying', energy: 0.85 },
  melancholic: { query: 'rainy piano cello slow', tempoFeel: 'deliberate', energy: 0.7 },
  меланхол: { query: 'rainy piano cello slow', tempoFeel: 'deliberate', energy: 0.7 },
  груст: { query: 'rainy piano cello slow', tempoFeel: 'deliberate', energy: 0.7 },
  cheerful: { query: 'sunny acoustic feel good', tempoFeel: 'bright', energy: 1.12 },
  солнеч: { query: 'sunny acoustic feel good', tempoFeel: 'bright', energy: 1.12 },
  cinematic: { query: 'cinematic strings ambient piano', tempoFeel: 'sweeping', energy: 0.9 },
  кинемат: { query: 'cinematic strings ambient piano', tempoFeel: 'sweeping', energy: 0.9 },
  summer: { query: 'warm acoustic indie summer', tempoFeel: 'breezy', energy: 1.05 },
  летн: { query: 'warm acoustic indie summer', tempoFeel: 'breezy', energy: 1.05 },
  rain: { query: 'rainy jazz piano lo-fi', tempoFeel: 'deliberate', energy: 0.72 },
  дожд: { query: 'rainy jazz piano lo-fi', tempoFeel: 'deliberate', energy: 0.72 },
  piano: { query: 'solo piano instrumental calm', tempoFeel: 'gentle', energy: 0.74 },
  пианино: { query: 'solo piano instrumental calm', tempoFeel: 'gentle', energy: 0.74 },
  фортепиан: { query: 'solo piano instrumental calm', tempoFeel: 'gentle', energy: 0.74 },
};

export interface MusicSearchResult {
  trackTitle: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
  source: 'itunes' | 'custom-link';
  genre?: string | null;
  musicProfile: {
    tempoFeel: string;
    energy: number;
    mood: string;
  };
}

function getMoodProfile(description: string): {
  searchTerm: string;
  tempoFeel: string;
  energy: number;
} {
  const lower = description.toLowerCase();
  const matchedTerms: string[] = [];
  let tempoFeel = 'balanced';
  let energy = 0.95;

  for (const [mood, meta] of Object.entries(MOOD_QUERY_MAP)) {
    if (lower.includes(mood)) {
      matchedTerms.push(meta.query);
      tempoFeel = meta.tempoFeel;
      energy = meta.energy;
    }
  }

  if (matchedTerms.length > 0) {
    return {
      searchTerm: matchedTerms[0],
      tempoFeel,
      energy,
    };
  }

  return {
    searchTerm: description.slice(0, 60),
    tempoFeel,
    energy,
  };
}

async function interpretMoodToQuery(description: string): Promise<{
  searchTerm: string;
  tempoFeel: string;
  energy: number;
}> {
  const base = getMoodProfile(description);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Convert this musical mood description (which may be in English or Russian) into a clean 3 to 5 word iTunes music catalog search query (no quotes, no punctuation). Description: "${description}"`,
      });
      const query = (response.text ?? '').trim().replace(/["'.]/g, '');
      if (query) {
        return { searchTerm: query, tempoFeel: base.tempoFeel, energy: base.energy };
      }
    } catch {
      // Fall back gracefully to mood map
    }
  }
  return base;
}

async function fetchAllowlistedOEmbed(parsedUrl: URL): Promise<{
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  providerLabel: string;
} | null> {
  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
  let oembedEndpoint: string | null = null;
  let targetUrl = parsedUrl.toString();
  let providerLabel = host;

  if (host === 'open.spotify.com') {
    oembedEndpoint = 'https://open.spotify.com/oembed';
    providerLabel = 'Spotify';
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    oembedEndpoint = 'https://www.youtube.com/oembed';
    providerLabel = host === 'music.youtube.com' ? 'YouTube Music' : 'YouTube';
    if (host === 'music.youtube.com') {
      const normalized = new URL(parsedUrl.toString());
      normalized.hostname = 'www.youtube.com';
      targetUrl = normalized.toString();
    }
  } else if (host === 'soundcloud.com' || host === 'on.soundcloud.com') {
    oembedEndpoint = 'https://soundcloud.com/oembed';
    providerLabel = 'SoundCloud';
  } else if (host === 'music.apple.com') {
    return { providerLabel: 'Apple Music' };
  }

  if (!oembedEndpoint) return { providerLabel };

  try {
    const endpoint = new URL(oembedEndpoint);
    endpoint.searchParams.set('url', targetUrl);
    endpoint.searchParams.set('format', 'json');
    const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { providerLabel };
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title ? String(data.title).trim() : undefined,
      authorName: data.author_name ? String(data.author_name).trim() : undefined,
      thumbnailUrl:
        data.thumbnail_url && /^https?:\/\//i.test(data.thumbnail_url) ? data.thumbnail_url : undefined,
      providerLabel,
    };
  } catch {
    return { providerLabel };
  }
}

export async function searchMusicCatalog(params: {
  mode: 'specific' | 'description' | 'custom';
  query: string;
  customTitle?: string;
  customArtist?: string;
}): Promise<{
  mode: string;
  interpretedQuery: string;
  tracks: MusicSearchResult[];
  message?: string;
}> {
  const cleanQuery = params.query.trim();
  if (!cleanQuery) {
    throw new Error('Please enter a song title, artist, mood description, or music link.');
  }

  if (params.mode === 'custom') {
    const normalizedInput = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanQuery)
      ? cleanQuery
      : `https://${cleanQuery}`;
    let parsed: URL;
    try {
      parsed = new URL(normalizedInput);
    } catch {
      throw new Error('Please enter a valid http or https music link (for example, Spotify, YouTube, or Apple Music).');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) {
      throw new Error('Please enter a valid web URL starting with https:// or http://.');
    }

    const meta = await fetchAllowlistedOEmbed(parsed);
    const fallbackHost = parsed.hostname.replace(/^www\./, '');
    const resolvedTitle = params.customTitle?.trim() || meta?.title || `${meta?.providerLabel || fallbackHost} Track`;
    const resolvedArtist = params.customArtist?.trim() || meta?.authorName || meta?.providerLabel || fallbackHost;

    return {
      mode: 'custom',
      interpretedQuery: parsed.toString(),
      message: meta?.title
        ? `Retrieved track details from ${meta.providerLabel}.`
        : `Attached valid ${meta?.providerLabel || fallbackHost} link. Automatic track metadata was unavailable, so your custom title/link is saved directly.`,
      tracks: [
        {
          trackTitle: resolvedTitle,
          artist: resolvedArtist,
          album: meta?.providerLabel || null,
          artworkUrl: meta?.thumbnailUrl || null,
          previewUrl: null,
          externalUrl: parsed.toString(),
          source: 'custom-link',
          musicProfile: {
            tempoFeel: 'personal',
            energy: 1.0,
            mood: 'User-curated track',
          },
        },
      ],
    };
  }

  const interpretation =
    params.mode === 'description'
      ? await interpretMoodToQuery(cleanQuery)
      : { searchTerm: cleanQuery, tempoFeel: 'balanced', energy: 1.0 };

  try {
    const itunesUrl = new URL('https://itunes.apple.com/search');
    itunesUrl.searchParams.set('term', interpretation.searchTerm);
    itunesUrl.searchParams.set('media', 'music');
    itunesUrl.searchParams.set('entity', 'song');
    itunesUrl.searchParams.set('limit', '8');

    const res = await fetch(itunesUrl.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return {
        mode: params.mode,
        interpretedQuery: interpretation.searchTerm,
        tracks: [],
        message:
          params.mode === 'description'
            ? 'Live song catalog is temporarily unreachable. You can still attach your musical mood description directly or paste a music link.'
            : 'Live song catalog is temporarily unreachable. You can paste a Spotify/YouTube link or describe the musical mood instead.',
      };
    }

    const data = (await res.json()) as { resultCount: number; results: ITunesResult[] };
    if (!data.results || data.results.length === 0) {
      return {
        mode: params.mode,
        interpretedQuery: interpretation.searchTerm,
        tracks: [],
        message:
          params.mode === 'description'
            ? 'No catalog tracks matched that wording, or you can save your mood description directly for the AI creative direction.'
            : 'No matching tracks were found in the catalog. Try a different spelling, describe the mood, or paste a music link.',
      };
    }

    const tracks: MusicSearchResult[] = data.results.map((r) => {
      const genre = (r.primaryGenreName || '').toLowerCase();
      let energy = interpretation.energy;
      let tempoFeel = interpretation.tempoFeel;
      if (params.mode === 'specific') {
        if (/(dance|electronic|rock|pop|hip-hop)/.test(genre)) {
          energy = 1.16;
          tempoFeel = 'rhythmic';
        } else if (/(classical|ambient|jazz|folk|acoustic)/.test(genre)) {
          energy = 0.84;
          tempoFeel = 'gentle';
        }
      }
      return {
        trackTitle: r.trackName,
        artist: r.artistName,
        album: r.collectionName || null,
        artworkUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '300x300bb') : null,
        previewUrl: r.previewUrl || null,
        externalUrl: r.trackViewUrl || null,
        source: 'itunes',
        genre: r.primaryGenreName || null,
        musicProfile: {
          tempoFeel,
          energy,
          mood: params.mode === 'description' ? cleanQuery : r.primaryGenreName || 'Selected track',
        },
      };
    });

    return {
      mode: params.mode,
      interpretedQuery: interpretation.searchTerm,
      tracks,
    };
  } catch {
    return {
      mode: params.mode,
      interpretedQuery: interpretation.searchTerm,
      tracks: [],
      message:
        'Music catalog lookup timed out. You can still attach your mood description directly or paste a Spotify/YouTube link.',
    };
  }
}
