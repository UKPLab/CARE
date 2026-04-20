Setup Wizard
============

The setup wizard provides the first-time configuration flow in CARE and is implemented in
``frontend/src/auth/SetupWizard.vue``.

When it is used
---------------

The wizard is shown for fresh instances where no admin account exists.
Instead of going directly to login, the user is guided through setup and then redirected
to the regular application flow.

Backend endpoints used by this flow:

- ``GET /setup/config``: fetch steps, wizard settings, and full settings snapshot.
- ``POST /auth/setup-admin``: create the initial admin account.
- ``POST /setup/test-mail``: send a test mail during setup.
- ``PATCH /setup/state``: mark setup as completed.

Wizard Steps
------------

The current step sequence is:

1. **Admin** (create first admin account)
2. **General** (base app behavior)
3. **Mail** (mail service and provider fields)
4. **Registration** (registration and consent-related settings)
5. **Summary** (final review and save)

.. note::

   Moodle-related wizard settings are currently grouped under **General** via subsection metadata.

How Settings Are Rendered
-------------------------

Wizard fields come from setting metadata in the database. For the setup flow and the
dashboard settings rework to stay aligned, settings should define:

- ``displayName``
- ``displayGroup``
- ``displaySubsection``
- ``showInWizard``
- ``wizardStep``
- ``wizardOrder``
- ``requiredInWizard``

For details and migration examples, see :doc:`../examples/settings`.

Import and Export
-----------------

The wizard supports JSON import/export to simplify migration from an existing CARE instance.

- **Download** exports a JSON snapshot based on loaded settings plus current wizard form values.
- **Import** accepts key/value JSON and normalizes values to strings for settings persistence.
- Imported keys are validated against known setting keys from ``/setup/config``.
- Unknown keys are ignored and reported in toast feedback.
- After successful import, the wizard moves to **Summary** for review before finishing.

Mail Test During Setup
----------------------

The mail step includes a test action that calls ``POST /setup/test-mail`` with the current
mail configuration and recipient address.

This allows validating SMTP/sendmail setup before finishing setup.

Extending the Wizard
--------------------

To add or change setup fields:

1. Add/update setting rows via migration (including wizard and display metadata).
2. Ensure the new keys are returned by ``/setup/config``.
3. If needed, update step-specific logic in ``SetupWizard.vue`` (validation, dependency toggles, and summary rendering).
4. Verify import/export behavior for the new keys.

To change the setup order or visible steps:

- Update wizard step definitions returned by ``/setup/config``.
- Keep frontend step filtering consistent with dependency rules.
