# Shared UI lint rules

These rules are registered as the `local` plugin in `../eslint.config.js`:

- `prefer-basic-components`: use BasicIcon for Bootstrap icon markup, BasicLoading
  (or an inline loading BasicIcon) for spinners, BasicTable for tables, and
  BasicModal for modal shells. Basic components and the existing Button wrappers
  are exempt so they can implement these primitives. Custom SVG assets remain valid.
- `footer-button-group`: place modal footer actions inside a static `btn-group`
  wrapper, including single buttons, nested wrappers, and `success-footer` slots.
  Card footers and modal body buttons are unaffected.
- `dashboard-list-page`: use DashboardListPage for Card + BasicTable layouts in
  top-level dashboard pages. It resolves imported component aliases and leaves
  tables inside imported modals alone.
- `dashboard-row-buttons`: build dashboard row button objects with
  `dashboardRowAction()` for common actions or `dashboardRowButton()` for custom
  icons. Objects with both `action` and `icon` outside these imported helper calls
  are reported in dashboard components. Helper overrides remain supported.

Run the rule regression tests from `frontend`:

```sh
node --test eslint-rules/rules.test.js
```

Run the repository checks from the repository root:

```sh
make lint
```

The rules report violations without automatically rewriting component layouts or
choosing action icons. Existing pages need migration before all new checks pass.
