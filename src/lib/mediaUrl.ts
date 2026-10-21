const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

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
