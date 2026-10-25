import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = JSON.parse(readFileSync('app.config.json', 'utf8')) as Record<string, unknown>;
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

describe('app.config.json', () => {
  it('holds the project identity', () => {
    expect(app.name).toBe('Fletchy');
    expect(app.appId).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    expect(String(app.storeTitle).length).toBeLessThanOrEqual(30);
  });

  it('keeps package.json version in sync', () => {
    expect(pkg.version).toBe(app.version);
  });

  it('never uses the dropped working title', () => {
    expect(JSON.stringify(app)).not.toMatch(/arrow\s*rush/i);
  });
});
