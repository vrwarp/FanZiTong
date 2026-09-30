// @vitest-environment node
import { gunzipSync } from 'node:zlib';
import { gzipText } from './download';

describe('gzipText', () => {
  it('gzips text that unpacks back to the same string', async () => {
    const text = JSON.stringify({ word: '滷肉飯', items: Array(200).fill({ rating: 3 }) }, null, 2);
    const blob = await gzipText(text);
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('application/gzip');
    const bytes = Buffer.from(await blob!.arrayBuffer());
    expect(bytes.length).toBeLessThan(Buffer.byteLength(text) / 10);
    expect(gunzipSync(bytes).toString('utf8')).toBe(text);
  });
});
