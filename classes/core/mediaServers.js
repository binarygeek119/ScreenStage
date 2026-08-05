/**
 * Multi media-server model: normalize, migrate, cap, and build clients.
 * Up to MEDIA_SERVER_MAX_PER_TYPE of each type (plex/jellyfin/emby/kodi).
 */
const crypto = require("crypto");
const {
  getMediaServerClass,
  getMediaServerKind,
  requiresMediaServerCredential,
  getMediaServerShortLabel,
} = require("../mediaservers/mediaServerFactory");

const MEDIA_SERVER_TYPES = ["plex", "jellyfin", "emby", "kodi"];
const MEDIA_SERVER_MAX_PER_TYPE = 10;

const ARR_SERVER_IDS = {
  sonarr: "arr-sonarr",
  radarr: "arr-radarr",
  lidarr: "arr-lidarr",
  readarr: "arr-readarr",
  chaptarr: "arr-chaptarr",
};

function newMediaServerId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return (
    "ms-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function toBoolStr(value, fallback) {
  if (value === undefined || value === null || value === "") {
    if (fallback === undefined || fallback === null) return "false";
    return fallback === true || fallback === "true" ? "true" : "false";
  }
  if (
    value === true ||
    value === "true" ||
    value === "on" ||
    value === 1 ||
    value === "1"
  ) {
    return "true";
  }
  return "false";
}

function defaultPortForType(type) {
  const t = getMediaServerKind(type);
  if (t === "jellyfin" || t === "emby") return 8096;
  if (t === "kodi") return 8080;
  return 32400;
}

/**
 * @param {object} raw
 * @returns {object}
 */
function normalizeMediaServerEntry(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let type = getMediaServerKind(src.type || src.mediaServerType || "plex");
  if (!MEDIA_SERVER_TYPES.includes(type)) type = "plex";
  const portRaw = src.port != null ? src.port : src.plexPort;
  let port = parseInt(portRaw, 10);
  if (isNaN(port) || port <= 0) port = defaultPortForType(type);
  const host = String(src.host != null ? src.host : src.plexIP || "").trim();
  const token = String(
    src.token != null ? src.token : src.plexToken != null ? src.plexToken : ""
  ).trim();
  const https = toBoolStr(
    src.https != null ? src.https : src.plexHTTPS,
    "false"
  );
  const id = String(src.id || "").trim() || newMediaServerId();
  let name = String(src.name || "").trim();
  if (!name) {
    name =
      getMediaServerShortLabel(type) + (host ? " @ " + host : " (new)");
  }
  return {
    id,
    type,
    name,
    https,
    host,
    port,
    token,
    enabled: toBoolStr(src.enabled, "true"),
    display: toBoolStr(src.display, "true"),
    enableNowPlaying: toBoolStr(src.enableNowPlaying, "true"),
    enableOnDemand: toBoolStr(
      src.enableOnDemand != null ? src.enableOnDemand : src.enableOD,
      "true"
    ),
    enableSync: toBoolStr(src.enableSync, "true"),
    libraries: String(
      src.libraries != null
        ? src.libraries
        : src.onDemandLibraries != null
        ? src.onDemandLibraries
        : ""
    ).trim(),
    libraries3d: String(
      src.libraries3d != null
        ? src.libraries3d
        : src.onDemand3dLibraries != null
        ? src.onDemand3dLibraries
        : ""
    ).trim(),
  };
}

/**
 * Cap at MEDIA_SERVER_MAX_PER_TYPE per type; drop incomplete empty drafts only when stripEmpty.
 * @param {unknown} list
 * @param {{ stripEmpty?: boolean }} [opts]
 */
function normalizeMediaServersArray(list, opts) {
  const stripEmpty = !!(opts && opts.stripEmpty);
  const arr = Array.isArray(list) ? list : [];
  const counts = { plex: 0, jellyfin: 0, emby: 0, kodi: 0 };
  const out = [];
  const seenIds = new Set();
  for (const raw of arr) {
    const entry = normalizeMediaServerEntry(raw);
    if (stripEmpty && !entry.host && !entry.token) continue;
    if (counts[entry.type] >= MEDIA_SERVER_MAX_PER_TYPE) continue;
    let id = entry.id;
    while (seenIds.has(id)) id = newMediaServerId();
    entry.id = id;
    seenIds.add(id);
    counts[entry.type]++;
    out.push(entry);
  }
  return out;
}

/**
 * Build one entry from legacy flat plex* / mediaServerType fields.
 * @param {object} settings
 */
function migrateLegacyToMediaServers(settings) {
  const s = settings || {};
  if (Array.isArray(s.mediaServers) && s.mediaServers.length > 0) {
    return normalizeMediaServersArray(s.mediaServers);
  }
  const host = String(s.plexIP || "").trim();
  if (!host) return [];
  return normalizeMediaServersArray([
    {
      id: newMediaServerId(),
      type: s.mediaServerType || "plex",
      name: "",
      https: s.plexHTTPS,
      host,
      port: s.plexPort,
      token: s.plexToken,
      enabled: "true",
      display: "true",
      enableNowPlaying: s.enableNS !== "false" ? "true" : "false",
      enableOnDemand: s.enableOD !== "false" ? "true" : "false",
      enableSync: "true",
      libraries: s.onDemandLibraries || "",
      libraries3d: s.onDemand3dLibraries || "",
    },
  ]);
}

/**
 * Keep legacy flat fields in sync with the first enabled (or first) server for older code paths.
 * @param {object} settings
 */
function syncLegacyFlatFromMediaServers(settings) {
  if (!settings || typeof settings !== "object") return settings;
  const list = normalizeMediaServersArray(settings.mediaServers || []);
  settings.mediaServers = list;
  const primary =
    list.find((e) => e.enabled === "true" && e.host) || list[0] || null;
  if (!primary) {
    settings.mediaServerType = "plex";
    settings.plexIP = "";
    settings.plexHTTPS = "false";
    settings.plexPort = 32400;
    settings.plexToken = "";
    return settings;
  }
  settings.mediaServerType = primary.type;
  settings.plexIP = primary.host;
  settings.plexHTTPS = primary.https;
  settings.plexPort = primary.port;
  settings.plexToken = primary.token;
  return settings;
}

function isEntryConfigured(entry) {
  if (!entry || !entry.host) return false;
  if (requiresMediaServerCredential(entry.type) && !entry.token) return false;
  return true;
}

function listConfiguredMediaServers(settings) {
  return normalizeMediaServersArray(
    (settings && settings.mediaServers) || []
  ).filter((e) => e.enabled === "true" && isEntryConfigured(e));
}

function listDisplayMediaServers(settings) {
  return listConfiguredMediaServers(settings).filter(
    (e) => e.display === "true"
  );
}

function listNowPlayingMediaServers(settings) {
  return listConfiguredMediaServers(settings).filter(
    (e) => e.enableNowPlaying === "true"
  );
}

function listSyncMediaServers(settings) {
  return listConfiguredMediaServers(settings).filter(
    (e) => e.enableSync === "true" || e.enableOnDemand === "true"
  );
}

function listDisplayServerIds(settings) {
  const ids = listDisplayMediaServers(settings).map((e) => e.id);
  const s = settings || {};
  if (s.enableSonarr !== "false" && s.sonarrURL && s.sonarrToken) {
    ids.push(ARR_SERVER_IDS.sonarr);
  }
  if (s.enableRadarr !== "false" && s.radarrURL && s.radarrToken) {
    ids.push(ARR_SERVER_IDS.radarr);
  }
  if (s.enableLidarr !== "false" && s.lidarrURL && s.lidarrToken) {
    ids.push(ARR_SERVER_IDS.lidarr);
  }
  if (s.enableReadarr !== "false" && s.readarrURL && s.readarrToken) {
    const kind =
      s.bookArrKind === "chaptarr" ? "chaptarr" : "readarr";
    ids.push(ARR_SERVER_IDS[kind] || ARR_SERVER_IDS.readarr);
  }
  return ids;
}

function createMediaServerClient(entry) {
  const e = normalizeMediaServerEntry(entry);
  const Pms = getMediaServerClass(e.type);
  return new Pms({
    plexHTTPS: e.https,
    plexIP: e.host,
    plexPort: e.port,
    plexToken: e.token,
  });
}

function cacheFilePrefix(serverId) {
  const id = String(serverId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return id || "unknown";
}

/**
 * Parse indexed form fields mediaServers[i][field] or JSON body.mediaServers.
 * @param {object} body
 */
function parseMediaServersFromFormBody(body) {
  if (!body || typeof body !== "object") return [];
  if (typeof body.mediaServersJson === "string" && body.mediaServersJson.trim()) {
    try {
      const parsed = JSON.parse(body.mediaServersJson);
      return normalizeMediaServersArray(parsed);
    } catch (e) {
      /* fall through */
    }
  }
  if (Array.isArray(body.mediaServers)) {
    return normalizeMediaServersArray(body.mediaServers);
  }
  // Indexed: mediaServers[0][host]
  const byIndex = {};
  for (const key of Object.keys(body)) {
    const m = /^mediaServers\[(\d+)\]\[(\w+)\]$/.exec(key);
    if (!m) continue;
    const idx = m[1];
    const field = m[2];
    if (!byIndex[idx]) byIndex[idx] = {};
    byIndex[idx][field] = body[key];
  }
  const indexes = Object.keys(byIndex)
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  return normalizeMediaServersArray(indexes.map((i) => byIndex[String(i)]));
}

function countByType(list) {
  const counts = { plex: 0, jellyfin: 0, emby: 0, kodi: 0 };
  for (const e of list || []) {
    const t = getMediaServerKind(e.type);
    if (counts[t] != null) counts[t]++;
  }
  return counts;
}

function validateMediaServersForSave(list) {
  const errors = [];
  const normalized = normalizeMediaServersArray(list);
  const counts = countByType(normalized);
  for (const t of MEDIA_SERVER_TYPES) {
    if (counts[t] > MEDIA_SERVER_MAX_PER_TYPE) {
      errors.push(
        "At most " +
          MEDIA_SERVER_MAX_PER_TYPE +
          " " +
          t +
          " servers are allowed."
      );
    }
  }
  for (const e of normalized) {
    if (!e.host && !e.token && e.enabled !== "true") continue;
    if (e.enabled === "true" || e.host || e.token) {
      if (!e.host) {
        errors.push(
          (e.name || e.type) + ": server address is required when enabled."
        );
      }
      if (!e.port || isNaN(parseInt(e.port, 10))) {
        errors.push((e.name || e.type) + ": port must be a number.");
      }
      if (requiresMediaServerCredential(e.type) && !e.token) {
        errors.push(
          (e.name || e.type) + ": token / API key is required for this type."
        );
      }
    }
  }
  return { ok: errors.length === 0, errors, mediaServers: normalized };
}

module.exports = {
  MEDIA_SERVER_TYPES,
  MEDIA_SERVER_MAX_PER_TYPE,
  ARR_SERVER_IDS,
  newMediaServerId,
  normalizeMediaServerEntry,
  normalizeMediaServersArray,
  migrateLegacyToMediaServers,
  syncLegacyFlatFromMediaServers,
  isEntryConfigured,
  listConfiguredMediaServers,
  listDisplayMediaServers,
  listNowPlayingMediaServers,
  listSyncMediaServers,
  listDisplayServerIds,
  createMediaServerClient,
  cacheFilePrefix,
  parseMediaServersFromFormBody,
  validateMediaServersForSave,
  countByType,
  getMediaServerKind,
  getMediaServerShortLabel,
  requiresMediaServerCredential,
};
