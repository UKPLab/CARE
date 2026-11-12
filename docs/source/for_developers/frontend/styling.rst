Styling
=======

CARE keeps its look in one place so that every page uses the same colours, corners, shadows and motion,
in both the light and the dark theme. This chapter explains where styles live and which shared tokens
and classes to use before you write any CSS of your own.

Where Styles Live
-----------------

.. list-table::
    :header-rows: 1

    * - File
      - Contains
    * - ``frontend/src/assets/styles/tokens.css``
      - Every CSS variable (design token): colours, radius scale, shadows, hover and focus states,
        easing curves and layers, with a light and a dark value where they differ.
    * - ``frontend/src/assets/styles/global.css``
      - Bootstrap overrides, the dashboard page shell, and classes shared by two or more components
        (buttons, badges, menus, modals, Home panels). Split into numbered sections.
    * - ``<style scoped>`` in a component
      - Everything only that component uses.

Both files are imported once in ``main.js``, after Bootstrap, tokens first.

**Which one to use?**

- A value (colour, radius, shadow, curve) always comes from a token. Do not write hex colours,
  pixel radii or ``cubic-bezier(...)`` into a component. If no token fits, add one to ``tokens.css``.
- A rule used by a single component goes into that component's ``<style scoped>``.
- A rule needed by two or more components goes into the matching section of ``global.css``.

Tokens
------

The most used tokens are listed below; ``tokens.css`` documents the rest group by group.

.. list-table:: Design tokens
    :header-rows: 1

    * - Token
      - Use for
    * - ``--care-primary`` / ``--care-on-primary``
      - CARE's main colour and the text on it. Blue in light mode, the accent yellow in dark mode.
        Use it instead of ``--bs-primary``, which stays blue in both themes.
    * - ``--care-radius-sm`` / ``-md`` / ``-lg`` / ``-xl`` / ``-2xl`` / ``-pill``
      - Corner radius: 6px small items, 8px buttons and inputs, 12px menus and panels, 14px cards
        and modals, 16px the dashboard page container, pill for badges.
    * - ``--care-card-*``
      - Surface, border, text and shadow of cards and of panels inside a page.
    * - ``--care-page-*``
      - Surface, border and shadow of the dashboard page container (``.dashboard-page``).
    * - ``--care-hover`` / ``--care-hover-danger``
      - Background of icon and ghost buttons on hover; the red variant for destructive actions.
    * - ``--care-row-hover`` / ``--care-active-bg``
      - A hovered list or table row; the selected item of a navigation list.
    * - ``--care-focus-ring``
      - The keyboard focus indicator, as a ``box-shadow``.
    * - ``--care-shadow-1`` / ``-2`` / ``-3``
      - Elevation, from resting cards to popups.
    * - ``--care-ease`` / ``--care-ease-spring`` / ``--care-dur-fast``
      - Motion curves and the short duration for hover transitions.
    * - ``--care-z-popover``
      - Popups teleported to ``<body>`` (menus, select lists, date picker), above modals.

.. code-block:: css

    .my-panel {
        border: 1px solid var(--care-card-border);
        border-radius: var(--care-radius-lg);
        background: var(--care-card-surface);
        transition: background-color var(--care-dur-fast) var(--care-ease);
    }

.. note::
    Dark mode needs no extra rule when you use tokens: each token already has its dark value.
    Write a ``[data-bs-theme="dark"]`` rule only for something the tokens cannot express.

Shared Classes
--------------

**Icon button** — a transparent button that shows only an icon (row actions, card actions, toolbars).
Add ``btn-icon-danger`` for destructive actions and ``btn-sm`` for the small size. A menu trigger shows
its open state through ``aria-expanded``, a toggle through ``aria-pressed``.

.. code-block:: html

    <BasicButton
        class="btn-icon"
        :title="$t('common.edit')"
        @click="edit"
    >
        <LoadIcon icon-name="pencil" />
    </BasicButton>

Put the icon in the slot: given only ``icon`` and ``title``, BasicButton shows the title as text next to the icon.

**Badges** — colour badges render as a light tint with darker text, and primary or secondary badges as
a neutral grey. Use ``badge-care-primary`` for a badge in CARE's primary colour.

**Popup menu** — for a "…" action menu, use the :doc:`PopupMenu <basic/basic>` base component instead
of writing a menu; its box is the shared ``.care-menu`` class that every popup list uses.

**Page shell** — put ``class="dashboard-page"`` on a dashboard page's ``<Card>``; see the comments in
section 9 of ``global.css`` for the header button row.
