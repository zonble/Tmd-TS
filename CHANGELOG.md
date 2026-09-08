# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-07

### Added
- Initial public TypeScript release of `tmd-ts`.
- Two-stage Lexer and TokenParser pipeline reproducing the complete TMD specification.
- Normalized musical AST structures (`Beat`, `Note`, `Unit`, `Section`, `Paragraph`, `Order`, `Sheet`).
- Formatter to serialize AST back to standard TMD syntax.
- Playback timeline calculation engine (`TMDPlaybackRenderer`).
- Exporters:
  - Multi-track Standard MIDI file exporter (`TMDMIDIGenerator`).
  - W3C MusicXML 4.0 Partwise exporter (`TMDMusicXMLGenerator`).
  - LilyPond source and PDF compiler exporter (`TMDLilyPondGenerator`).
  - ABC Notation v2.1+ exporter (`TMDABCGenerator`).
  - Portable fallback 16-bit stereo PCM WAV synthesizer (pure sine wave) (`TMDWAVRenderer`).
- Command-line interface `tmd` executable with options for parsing, export, playback, and AI agent skill installation (`--install-skills`).
- AI Agent Skill provider (`TmdSkill`) compatible with Codex, Claude Code, Antigravity, and Gemini agent directories.
- Full Vitest test suite and GitHub Actions CI workflow.
