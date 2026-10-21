import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCameraPreviewUrl } from './mediaUrl';

afterEach(() => vi.unstubAllGlobals());

describe('camera previews', () => {
  it('uses the configured SSL domain for an RTMP camera on HTTPS', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    expect(buildCameraPreviewUrl(
      { stream_key: '83631353490', stream_url: 'rtmp://187.77.255.210:1935/83631353490' },
      [{ ip_address: '187.77.255.210', domain: 'bilheteiapro.com', webrtc_base_port: 8889 }],
    )).toBe('https://bilheteiapro.com:8889/83631353490/');
  });

  it('selects the publishing server rather than another server in the list', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    expect(buildCameraPreviewUrl(
      { stream_url: 'rtmp://187.77.255.210:1935/83631353490' },
      [{ ip_address: '192.0.2.1', domain: 'other.example.com' },
       { ip_address: '187.77.255.210', domain: 'bilheteiapro.com', webrtc_base_port: 8889 }],
    )).toBe('https://bilheteiapro.com:8889/83631353490/');
  });

  it('does not invent a camera path when no stream key exists', () => {
    expect(buildCameraPreviewUrl({}, [{ ip_address: '187.77.255.210' }])).toBe('');
  });
});