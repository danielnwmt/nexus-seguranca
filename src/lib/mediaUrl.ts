const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

/** Pick a domain-type media server host (needed for HTTPS/SSL). */
export const pickMediaDomain = (servers: any[] = []): string => {
  const s = (servers || []).find((m: any) => m?.ip_address && !isIp(String(m.ip_address).trim()));
  return s ? String(s.ip_address).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';
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
    if ((!h || isIp(h)) && mediaDomain) h = mediaDomain;
  }
  return `${sc}://${h}:${port}/${key}/`;
};
