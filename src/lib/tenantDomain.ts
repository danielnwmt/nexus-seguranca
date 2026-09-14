const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'owner']);

export const normalizeSubdomain = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 63);

export const getTenantSubdomain = () => {
  if (typeof window === 'undefined') return null;

  const configuredDomain = String(import.meta.env.VITE_SAAS_BASE_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const hostname = window.location.hostname.toLowerCase();

  if (!configuredDomain || !hostname.endsWith(`.${configuredDomain}`)) return null;

  const candidate = hostname.slice(0, -(configuredDomain.length + 1));
  return candidate && !candidate.includes('.') && !RESERVED_SUBDOMAINS.has(candidate) ? candidate : null;
};

export const getCompanyUrl = (subdomain: string) => {
  const configuredDomain = String(import.meta.env.VITE_SAAS_BASE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return configuredDomain ? `https://${subdomain}.${configuredDomain}` : subdomain;
};