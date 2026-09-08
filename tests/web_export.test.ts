import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zhTW } from '../web/src/locales/zh-TW.js';
import { en } from '../web/src/locales/en.js';

describe('Web UI Exporters & REAPER support (TDD)', () => {
  it('defines REAPER export i18n labels in zh-TW and en locales', () => {
    expect((zhTW as any).exportReaper).toBe('REAPER 專案檔 (.rpp)');
    expect((en as any).exportReaper).toBe('REAPER Project (.rpp)');
  });

  it('includes REAPER export button in index.html with i18n attribute', () => {
    const htmlPath = path.join(__dirname, '../web/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="export-reaper"');
    expect(html).toContain('data-i18n="exportReaper"');
  });

  it('binds export-reaper button in web/src/main.ts and handles RPP download', () => {
    const mainPath = path.join(__dirname, '../web/src/main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    expect(mainContent).toContain('export-reaper');
    expect(mainContent).toContain('TMDReaperGenerator');
    expect(mainContent).toContain('.generateRPP(');
  });
});
