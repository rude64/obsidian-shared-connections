# Shared Connections for Obsidian

Focus on concepts shared by multiple articles instead of every individual outgoing link.

```text
Article A ── Heritage ── Article B
Article B ── Identity ── Article C
```

Shared Connections opens its own graph tab. It does **not** change or filter Obsidian's built-in Graph view. Notes, links and tags are never edited. Everything runs locally, with no network requests or external dependencies.

## Install the preview

1. Download `shared-connections.zip` from [Releases](https://github.com/rude64/obsidian-shared-connections/releases/latest) and extract it.
2. Copy the extracted `shared-connections` folder into `<your vault>/.obsidian/plugins/`.
3. The folder must contain `manifest.json`, `main.js` and `styles.css`.
4. Reload Obsidian, then enable **Shared Connections** under **Settings → Community plugins**. Community plugins must be allowed.
5. Open the plugin's settings and set **Source folder** to your articles folder, for example `Articles`. Use the path relative to the vault, including parent folders if necessary. An empty setting counts every Markdown note as a source.
6. Run **Shared Connections: Open shared connections** from the command palette, or click the fork icon in the ribbon.

This preview is not yet listed in the community plugin directory.

## Settings and interaction

- **Source folder:** source Markdown notes in this folder and its subfolders. Folder names are case-sensitive. Targets may be anywhere in the vault.
- **Minimum referring articles:** 2 by default; also supports 3, 4, 5 or 10.
- **Include missing concepts:** show shared links whose destination notes do not exist yet.
- Shared concepts are red by default; referring source notes are green. Both colors can be changed under **Graph controls → Display**. Matching color groups override these defaults. Missing concepts have a dashed outline.
- Click an existing node to open its note in a new tab. Clicking a missing concept displays its name and does not create a file.
- Scroll to zoom, drag the background to pan, and drag nodes to rearrange them. Hover a node to highlight its neighbors. Labels appear on hover or when zoomed in, with overlap suppression. **Fit graph** resets the overview. Expand the list below the graph for full paths and the referring articles. The expandable article list provides keyboard-accessible note links.
- The graph refreshes when Obsidian resolves its link index, when notes are renamed/deleted, or when settings change. **Refresh** also rebuilds it manually.

## Counting rules

Each distinct source note contributes at most one reference to a target, regardless of how often the link occurs. Self-links and non-Markdown destinations are ignored. Resolved destinations use Obsidian's canonical file paths, so resolved aliases and heading links refer to the same concept. The graph uses Obsidian's metadata index, including indexed embeds, rather than a regular-expression scan of note text.

Missing destinations use their exact unresolved link paths, with heading/block suffixes and a trailing `.md` removed. Unresolved names with different spelling, case or folder paths remain separate: the plugin cannot infer that they mean the same thing. If Obsidian resolves them to one existing file later, they become one destination.

Only qualifying concept edges are displayed. An article that is itself shared can act as both a source and concept; it appears once. This is not a recursive graph pruning algorithm: the threshold is calculated from the selected source notes, not repeatedly recalculated from visible nodes.

## Current limitations

- Version 0.3.1 is a preview. Automated logic and loading checks are included; interactive validation in a live Obsidian vault is still required before a public stable release.
- The graph uses an animated force layout rendered on canvas, with spatially bounded repulsion for large vaults. It remains an independent graph rather than Obsidian's built-in renderer. Large networks may still benefit from a narrower source folder or higher threshold.
- Automatic refresh rebuilds the graph and resets zoom/pan.
- Search supports names, quoted phrases, `path:`, `file:`, `tag:`, exclusions (`-term`) and uppercase `OR` (spaces mean AND). It does not implement the complete Obsidian search grammar: content, property, regular expression and parenthesized queries are not supported. Tag filters use inline and frontmatter tags on existing notes; missing concepts have no tags.
- Tags and attachments are not separate graph nodes. Orphans are always hidden, and time-lapse animation is not included.
- The plugin does not automatically install or enable itself.

## Development

Source is plain CommonJS JavaScript; the generated `main.js` bundles the graph logic. No package installation is required. With Node.js 18 or newer:

```sh
npm test
npm run check
```

Create the installation ZIP with Python 3:

```sh
python3 build.py
python3 package.py
```

To test changes, copy the three runtime files into a test vault's plugin directory and reload the plugin. Test resolved and missing concepts, folder selection, rename/delete refresh, light/dark themes, zoom/pan, keyboard navigation and reopening the tab after an Obsidian restart. Desktop and mobile are intended targets; neither has been interactively certified in this preview.

## Publishing on GitHub

Create a repository containing this directory's source files, README, license and tests. Before publishing a stable release, complete the live-vault checks above. The included workflow runs tests and syntax checks for pushes and pull requests.

Create a GitHub release with a tag matching `manifest.json` (currently `0.3.1`), and attach `main.js`, `manifest.json`, `styles.css` and the installation ZIP. Follow the current official submission requirements if you want to apply for the Obsidian community directory.

## License

MIT © 2026 Ruud Raats.

## Graph controls (0.3.0)

Open **Graph controls** above the graph. Settings persist across restarts.

- **Filters:** search nodes, choose source folder and minimum references, toggle existing files only. Press Enter or Apply to run a node query. Example: `tag:heritage OR path:"Castle studies" -file:Index` (exclusions apply within their OR branch).
- **Keep direct neighbors:** keep the immediate neighbors of search matches for context. Turn off for strict node matching. Nodes without a remaining edge are hidden. Shared-concept eligibility is always calculated before the display query, from the source folder and minimum count.
- **Groups:** add search/color pairs; the first matching nonempty group sets a node's color. Empty groups do not match anything.
- **Display:** node size, link thickness, label zoom threshold and directed arrows. Arrows point from the referring article to the concept.
- **Forces:** center, repulsion, link strength and link distance. Changes restart the simulation without resetting zoom/pan.
- **Reset graph controls:** reset display filters, groups, display and force sliders. The source folder, minimum references and existing-files setting remain unchanged.

This is an independent graph with familiar controls, not complete feature parity with the native Graph view.
