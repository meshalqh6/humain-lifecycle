# HUMAIN Lifecycle presentation source

The final presentation and PDF are in the parent `submission` folder. The deck has ten 16:9 slides. Titles, copy, architecture nodes, process diagrams and connectors are native editable PowerPoint objects. The HUMAIN wordmarks and actual product screenshots remain image objects. All slide text uses Inter. The accompanying PDF embeds Inter and retains vector text and diagrams.

## Contents

- `build.mjs`: authors the deck and renders 2560 x 1440 slide previews.
- `finalize.mjs`: validates slide count, package integrity, geometry and font policy, then copies the validated PPTX to the requested filename.
- `export-pdf.mjs`: imports the validated PPTX, registers Inter for PDF embedding and exports the PDF. The local standard-font alias adapter supplies a missing runtime resource without changing installed dependencies.
- `speaker_notes.md`: the same speaker notes and source references included in the PowerPoint.
- `evidence_sources.md`: claim provenance and limits.
- `slides.json`: slide titles and design modes.
- `../presentation_assets/`: genuine UI captures, derived crops, existing HUMAIN assets and licensed Inter fonts.

## Rebuild

The JavaScript uses `@oai/artifact-tool` 2.8.118, its bundled Skia Canvas, Sharp and the PDF-Lib standard-font data. It does not require application changes or live business writes. All screenshot pixels needed to rebuild are already supplied.

Run `build.mjs`, then `finalize.mjs`, then `export-pdf.mjs` from the repository root using the supplied Codex Node runtime. Set `RUNTIME_NODE_MODULES` to the bundled Node package directory when using another runtime location. `PRESENTATIONS_SKILL_DIR` overrides the finalizer helper location. The defaults point to the runtime on the authoring computer. The finalizer uses a fresh timestamped staging filename to preserve earlier outputs.

PowerPoint viewers need the supplied Inter font installed for matching native rendering. The PDF embeds the fonts and is suitable for consistent viewing. Inter's OFL license is included in the font directory.

The local demo link on slide 10 requires HUMAIN Lifecycle running on the presenting computer at `http://127.0.0.1:5173`. There is no invented public video URL or QR code.

Screenshots were captured on 31 October 2026, Asia/Riyadh. Only synthetic employee records appear in the selected product views. The application was not modified for this presentation.
