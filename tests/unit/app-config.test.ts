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

  it('has an author for the About screen', () => {
    const author = app.author as { name: string; intro: string; github: string };
    expect(author.github).toMatch(/^https:\/\/github\.com\//);
    expect(author.intro.length).toBeGreaterThan(20);
  });

  it('never uses the dropped working title', () => {
    expect(JSON.stringify(app)).not.toMatch(/arrow\s*rush/i);
  });
});

describe('store listing text (Google Play limits)', () => {
  const store = app.store as {
    shortDescription: string;
    fullDescription: string;
    releaseNotes: string;
    screenshots: { shot: string; caption: string }[];
  };

  it('fits the Play Console limits', () => {
    expect(String(app.storeTitle).length).toBeLessThanOrEqual(30);
    expect(store.shortDescription.length).toBeLessThanOrEqual(80);
    expect(store.fullDescription.length).toBeLessThanOrEqual(4000);
    expect(store.releaseNotes.length).toBeLessThanOrEqual(500);
  });

  it('has at least 4 captioned screenshots', () => {
    expect(store.screenshots.length).toBeGreaterThanOrEqual(4);
    for (const s of store.screenshots) expect(s.caption.length).toBeLessThanOrEqual(40);
  });

  it('keeps the mode names', () => {
    expect(store.fullDescription).toContain('RUSH');
    expect(store.fullDescription).toContain('DAILY GRID');
    expect(store.fullDescription).toContain('LEVELS');
  });
});
