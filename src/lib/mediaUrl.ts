const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

/** Resolve previews against the publishing media server, never the recording storage server. */
export const buildCameraPreviewUrl = (
  camera: { stream_key?: string | null; stream_url?: string | null },
  servers: { ip_address?: string; domain?: string | null; webrtc_base_port?: number }[],
): string => {
  let source: URL | undefined;
  try {
    if (camera.stream_url) source = new URL(camera.stream_url);
  } catch { /* Fall back to the saved stream key and configured media server. */ }
  const key = camera.stream_key || source?.pathname.replace(/^\/+|\/+$/g, '') || '';
  const server = servers.find(s => s.ip_address === source?.hostname || s.domain === source?.hostname) || servers[0];
  const host = server?.domain?.trim() || source?.hostname || server?.ip_address || '';
  if (!host || !key) return '';
  return buildPlayableUrl('http', host, server?.webrtc_base_port || 8889, key, pickMediaDomain(server ? [server] : []));
};

/** Pick a domain-type media server host (needed for HTTPS/SSL). */
export const pickMediaDomain = (servers: any[] = []): string => {
  const clean = (v: string) => v.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // Prefer explicit domain field, then a non-IP ip_address
  const withDomain = (servers || []).find((m: any) => m?.domain && String(m.domain).trim());
  if (withDomain) return clean(String(withDomain.domain));
  const s = (servers || []).find((m: any) => m?.ip_address && !isIp(String(m.ip_address).trim()));
  return s ? clean(String(s.ip_address)) : '';
};

/** Builds a browser-playable WebRTC URL, forcing HTTPS + domain when the app runs on HTTPS. */
export const buildPlayableUrl = (
  scheme: 'http' | 'https',
  host: string,
  port: number,
  key: string,
  mediaDomain = '',
): string => {
  let h = host;
  let sc = scheme;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    sc = 'https';
    // On HTTPS pages an IP host is always blocked (mixed content / no cert): swap to the domain.
    if (mediaDomain && (!h || isIp(h))) h = mediaDomain;
  }
  return `${sc}://${h}:${port}/${key}/`;
};

/** Builds an HLS (index.m3u8) URL with the same HTTPS/domain rules. */
export const buildHlsUrl = (
  scheme: 'http' | 'https',
  host: string,
  port: number,
  key: string,
  mediaDomain = '',
): string => {
  let h = host;
  let sc = scheme;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    sc = 'https';
    if (mediaDomain && (!h || isIp(h))) h = mediaDomain;
  }
  return `${sc}://${h}:${port}/${key}/index.m3u8`;
};
