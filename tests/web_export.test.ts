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

  it('defines VOCALOID export i18n labels in zh-TW and en locales', () => {
    expect((zhTW as any).exportVsq).toBe('VOCALOID2 專案檔 (.vsq)');
    expect((en as any).exportVsq).toBe('VOCALOID2 Project (.vsq)');
    expect((zhTW as any).exportVsqx).toBe('VOCALOID3/4 專案檔 (.vsqx)');
    expect((en as any).exportVsqx).toBe('VOCALOID3/4 Project (.vsqx)');
  });

  it('includes VOCALOID export buttons in web/index.html with i18n attributes', () => {
    const htmlPath = path.join(__dirname, '../web/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="export-vsq"');
    expect(html).toContain('data-i18n="exportVsq"');
    expect(html).toContain('id="export-vsqx"');
    expect(html).toContain('data-i18n="exportVsqx"');
  });

  it('binds export-vsq and export-vsqx buttons in web/src/main.ts', () => {
    const mainPath = path.join(__dirname, '../web/src/main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    expect(mainContent).toContain('export-vsq');
    expect(mainContent).toContain('export-vsqx');
    expect(mainContent).toContain('TMDVSQGenerator');
    expect(mainContent).toContain('TMDVSQXGenerator');
  });

  it('removes top toolbar sample-select dropdown and relies on drawer samples list', () => {
    const htmlPath = path.join(__dirname, '../web/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).not.toContain('id="sample-select"');
    expect(html).toContain('id="library-samples-list"');

    const mainPath = path.join(__dirname, '../web/src/main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    expect(mainContent).not.toContain('sample-select');
    expect(mainContent).not.toContain('sampleSelect');
  });

  it('includes AI validation banner and repair wiring in web/index.html and web/src/main.ts', () => {
    const htmlPath = path.join(__dirname, '../web/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="ai-validation-banner"');
    expect(html).toContain('id="btn-ai-retry-repair"');

    const mainPath = path.join(__dirname, '../web/src/main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    expect(mainContent).toContain('validateTmdCode');
    expect(mainContent).toContain('buildRepairPrompt');
    expect(mainContent).toContain('btn-ai-retry-repair');
  });
});
