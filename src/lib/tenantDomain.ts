const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'owner']);

export const normalizeSubdomain = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 63);

export const normalizeDomain = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .replace(/^www\./, '')
  .replace(/\.$/, '');

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

export const getTenantAddress = () => {
  if (typeof window === 'undefined') return { subdomain: null, customDomain: null };
  const subdomain = getTenantSubdomain();
  if (subdomain) return { subdomain, customDomain: null };

  const hostname = normalizeDomain(window.location.hostname);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return { subdomain: null, customDomain: isLocal ? null : hostname };
};

export const getCompanyUrl = (subdomain: string) => {
  const configuredDomain = String(import.meta.env.VITE_SAAS_BASE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return configuredDomain ? `https://${subdomain}.${configuredDomain}` : subdomain;
};

export const getCompanyAccessUrl = (company: { subdomain: string; domain_type?: string; custom_domain?: string | null }) =>
  company.domain_type === 'custom' && company.custom_domain
    ? `https://${normalizeDomain(company.custom_domain)}`
    : getCompanyUrl(company.subdomain);