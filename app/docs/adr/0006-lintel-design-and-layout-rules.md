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

1. Blocks on a page are separated by `--gap` only. The page (`.route`) is a flex column; a block never sets its own outer margin.
2. A card's edge padding is `--card-py` / `--card-px`. Anything inside a card (head, toolbar, chip row, table cells, chart, list row, dialog head/body/actions) uses the same two values at its outer edge, so text lines up with the card's own heading. A block inside a card does not add its own outer padding on top.
3. Rows inside one block (filter rows, tiles) are `--sp-2`–`--sp-3` apart.
4. KPI cards (`.stats > .stat`) are one size: same padding, label / value / foot, equal height in a row, foot pinned to the bottom and wrapping rather than truncated. The grid is `auto-fit` with a 9.5 rem minimum so cards share the row with no dead space.
5. Tile groups (`.ins-boxes`) are flex-wrapped so a short last row stretches instead of leaving an orphan. Chart grids use `grid-auto-flow: row dense` so a full-width chart does not leave a hole.
6. Do not hard-code paddings in page code. If a page needs different spacing, change the token or the shared class.

7. Spacing inside page code uses the token utilities `mt-1…5`, `mb-0…5`, `my-4` (4-point scale) or a shared class (`panel-body`, `boot-state`, `bar-stack`); a pixel value in `style={{}}` is only allowed for data-driven indents, written as `calc(<depth> * var(--sp-4))`.
8. Chart rows and two-column card grids never leave an empty part of a row: a last chart or card on its own row takes the remaining width (shared rules in `styles.css`, no per-page props needed).
9. KPI figures shrink with their card (container query) rather than overflow; large figures use a compact format on the card (for example `2.96M h`) and the full value in tables.

## Type, motion and wording

- Text is never below 12 px (`--fs-xs`), including `<small>` and chart axis labels (`fontSize: 12`).
- One icon per meaning across task, issue and calendar views: deadline/due `flag`, overdue `clock` (crit tone), effort `hourglass`, status and urgency their `status-*`/`urgency-*` icons. View, scale and period switches are labelled segmented controls (`.seg`, `aria-pressed`); an icon-only control is allowed only where its word is in `aria-label` and visible nearby.
- Motion uses `--dur-fast` (.14 s, hover and focus), `--dur` (.22 s, menus, drawers, tabs) and `--dur-slow` (.32 s, entrances) with one easing, `--ease`. Only transform and opacity animate; `prefers-reduced-motion` turns all motion off.
- A page-level create button and its dialog title read **New <item>** (New issue, New activity, New equipment); in-row composers read **Add**. Form dialogs end with Cancel and Save; detail dialogs with Close.

## No gaps in card layouts

A card layout has no void beside, below or inside a card. Measured on every route at 375, 768, 1024, 1280, 1440 and 1920 px.

- **Summary boxes** (`.ins-boxes`) sit on a 60-column grid, so 1 to 9 boxes always fill their rows: one row up to 5 boxes, then two even rows; in a narrow card 4 boxes are 2 by 2 and 5 are 3 over 2. Never set a fixed column count (the old `repeat(max(5, …))` left a dead column when a card had 4 boxes).
- **A chart without data is left out** (`InsightsView`), not shown as an empty "Nothing to chart yet" card.
- **Cards of one row share the row's height** (`align-items: stretch`); the link at the foot of a card sits at the bottom (`margin-top: auto`); bars and list rows share the height left over, so nothing ends early. Lists paired in a row are capped to similar length (the dashboard's Shipments list shows at most seven rows).
- **Fixed sets of tiles** (Knowledge domains) take their column count from the number of tiles (`balancedColumns` in `format.ts`: 9 tiles are 3 by 3, not 4 + 4 + 1); an odd last tile at 2 columns takes the row.
- **Registers**: the search field takes the width the filters leave (`flex: 1 1 18rem`), never a squeezed box.

## Interaction and motion

- Sections of a page rise in one after the other (first eight, 40 ms apart); KPI cards follow a beat faster. Sub-entries of the navigation glide in under their parent; the sidebar width glides when it collapses to the icon rail (`@property --sidebar-w`, registered with a **px** initial value, as `rem` is rejected).
- Controls answer a hover in `--dur-fast`; a press sinks 1 px; a primary button lifts 1 px with a soft shadow. Cards that open something (tiles, clickable boxes, task cards) lift 2 px. The active tab line is drawn in.
- Switching light and dark cross-fades colours for 320 ms (`.theme-fade` on `<html>`, set by `setDark`), with a gentler curve than `--ease`.
- Everything above is switched off by `prefers-reduced-motion`.

## Phones (≤ 720 px)

- Drawers and dialogs open as **bottom sheets**: full width, up to 92 % of the height, rounded top, grab handle, slide up.
- **Registers render as cards**, one per row, label above value, first cell as the card title. `mobileTables.ts` copies each column header onto its cells (`data-label`) and watches the page for new rows, so any `<table>` is covered. Matrix, workload and WBS tables keep their grid and may scroll sideways.
- Filter rows use full-width search and two filters per row. No page may scroll horizontally.

## Links to items

Every detail that opens in a drawer has its own address: `?id=<item id>` on the page's route (`?id=new` for a blank form), for example `/m/management.risks?id=CTR-CTR-0019`. Use `useDeepLink()` (id-only state) or `useDeepLinkItem(rows, getId)` from `src/deepLink.ts` instead of local `useState` for the open item. Opening adds a history entry (Back closes the drawer), closing replaces it, and other query parameters such as filters are kept. A page that finds its row in the loaded page (`useDeepLinkItem`) only opens ids on the current page of the register.

## Checklist for a new or changed page

- Open item is kept in `?id=` (see Links to items).
- Uses `PageHead`, `.stats`/`Stat`, `.panel`, `DataTable` or `.table-wrap`, `Modal`: nothing custom for spacing.
- Looks right at 1440 px, 1024 px and 375 px, in light and dark, with no void beside, below or inside a card.
- No `style={{ margin…, padding… }}` on cards or their direct children.
