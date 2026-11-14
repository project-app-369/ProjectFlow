# 0006 — Lintel design and layout rules

Supersedes the navy navigation and 6–10 px radii in [0005](0005-enterprise-visual-system.md). Colour tokens, chart theming and progress-bar rules from 0005 still apply.

## Context

The `try-new-UI` branch moves the web client to a soft-glass look (named "Lintel" after the reference screenshot): pastel gradient canvas, frosted floating navigation, white rounded cards, pill controls. Pages had grown their own paddings and margins, so cards of the same kind looked different from page to page, and registers needed sideways scrolling on phones. This record is the contract that new pages follow.

## Look

- **Shell**: a floating glass sidebar on the left (pill entries, dock-style hover scale on the entry and its neighbours) and a floating glass top bar (project, cut-off, theme, notifications, account). No dark navy rail.
- **Surfaces**: `--surface` cards with `--r-lg` (22 px) corners and the shared soft shadow; page canvas is the gradient on `body`. Dark mode swaps tokens only, never rules.
- **Controls**: buttons, chips, tabs and segmented controls are pills (`--pill`). The primary action is the blue gradient. The selected choice is solid `--ink`, not teal, and never bold.
- **Titles**: page title only (breadcrumb above it). No project-code eyebrow and no description paragraph under it; the description is the title's tooltip.
- **Numbers on KPI cards count up** on first render and on change; reduced-motion users see the final value.

## Spacing contract (applies to every card)

Tokens in `styles.css`: `--gap` (1 rem), `--card-px` (1.25 rem; 1 rem on phones), `--card-py` (1 rem; .875 rem on phones).

1. Blocks on a page are separated by `--gap` only. The page (`.fade`) is a flex column; a block never sets its own outer margin.
2. A card's edge padding is `--card-py` / `--card-px`. Anything inside a card (head, toolbar, chip row, table cells, chart, list row, dialog head/body/actions) uses the same two values at its outer edge, so text lines up with the card's own heading. A block inside a card does not add its own outer padding on top.
3. Rows inside one block (filter rows, tiles) are `--sp-2`–`--sp-3` apart.
4. KPI cards (`.stats > .stat`) are one size: same padding, label / value / foot, equal height in a row, foot pinned to the bottom and wrapping rather than truncated. The grid is `auto-fit` with a 9.5 rem minimum so cards share the row with no dead space.
5. Tile groups (`.ins-boxes`) are flex-wrapped so a short last row stretches instead of leaving an orphan. Chart grids use `grid-auto-flow: row dense` so a full-width chart does not leave a hole.
6. Do not hard-code paddings in page code. If a page needs different spacing, change the token or the shared class.

## Phones (≤ 720 px)

- Drawers and dialogs open as **bottom sheets**: full width, up to 92 % of the height, rounded top, grab handle, slide up.
- **Registers render as cards**, one per row, label above value, first cell as the card title. `mobileTables.ts` copies each column header onto its cells (`data-label`) and watches the page for new rows, so any `<table>` is covered. Matrix, workload and WBS tables keep their grid and may scroll sideways.
- Filter rows use full-width search and two filters per row. No page may scroll horizontally.

## Links to items

Every detail that opens in a drawer has its own address: `?id=<item id>` on the page's route (`?id=new` for a blank form), for example `/m/management.risks?id=CTR-CTR-0019`. Use `useDeepLink()` (id-only state) or `useDeepLinkItem(rows, getId)` from `src/deepLink.ts` instead of local `useState` for the open item. Opening adds a history entry (Back closes the drawer), closing replaces it, and other query parameters such as filters are kept. A page that finds its row in the loaded page (`useDeepLinkItem`) only opens ids on the current page of the register.

## Checklist for a new or changed page

- Open item is kept in `?id=` (see Links to items).
- Uses `PageHead`, `.stats`/`Stat`, `.panel`, `DataTable` or `.table-wrap`, `Modal`: nothing custom for spacing.
- Looks right at 1440 px, 1024 px and 375 px, in light and dark.
- No `style={{ margin…, padding… }}` on cards or their direct children.
