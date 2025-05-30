Settings
========

CARE supports flexible application behavior through dynamic configuration of settings. This section shows how to create a new setting and use it in the frontend.

Example: Adding a New Setting
-----------------------------

1. Add a migration
~~~~~~~~~~~~~~~~~~
At first you need to add a new migration - please check out the :doc:`../backend/database` for the details.
To add a new setting, define it similar to this example:

.. code-block:: javascript

    'use strict';

    const settings = [{
        key: "editor.document.enableComments",
        value: "true",
        type: "boolean",
        description: "Enable or disable comment functionality in the document editor"
    }];

    module.exports = {
        async up(queryInterface, Sequelize) {
            await queryInterface.bulkInsert('setting', settings.map(t => {
                t['createdAt'] = new Date();
                t['updatedAt'] = new Date();
                return t;
            }), { returning: true });
        },

        async down(queryInterface, Sequelize) {
            await queryInterface.bulkDelete("setting", {
                key: settings.map(t => t.key)
            }, {});
        }
    };

Don't forget to restart the server. The setting will now be available in the frontend.

Supported Setting Types
~~~~~~~~~~~~~~~~~~~~~~~~

The ``type`` field of a setting defines how the setting is interpreted and rendered in the frontend. The following types are currently supported:

- ``boolean``:
  Enables a checkbox or toggle in the UI.

  .. code-block:: javascript

      {
          key: "editor.document.enableComments",
          value: "true",
          type: "boolean",
          description: "Enable or disable comment functionality in the document editor"
      }

- ``number`` or ``integer``:
  Enables a numeric input field (as string or integer).
  
  .. code-block:: javascript

      {
          key: "editor.edits.debounceTime",
          value: "150",
          type: "number",
          description: "Delay time in milliseconds before processing edits"
      }

- ``string`` (default):
  Basic text field input. If ``type`` is omitted, it is treated as string by default.

  .. code-block:: javascript

      {
          key: "dashboard.navigation.component.default",
          value: "Home",
          description: "The default component to display in the dashboard"
      }

- ``html``:
  Allows multi-line rich-text (HTML) input in the frontend, shown with a textarea.

  .. code-block:: javascript

      {
          key: "app.register.terms",
          type: "html",
          value: "<p>Please agree to the terms and conditions.</p>",
          description: "Terms and conditions text shown during registration"
      }

You can mix and match these types depending on your use case. The value must always be provided as a **string**, regardless of type.

2. Use your Settings in the Frontend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
You can access the setting value inside any component using Vuex:

.. code-block:: javascript

        this.$store.getters["settings/getValue"]("editor.document.enableComments")

Example usage in a component:

.. code-block:: none

        <BasicButton
            v-if="commentsEnabled"
            text="Add Comment"
            @click="addComment"
        />

.. code-block:: javascript

        export default {
            computed: {
                commentsEnabled() {
                    return this.$store.getters["settings/getValue"]("editor.document.enableComments") === "true";
                }
            },
            methods: {
                addComment() {
                    console.log("Add comment clicked");
                }
            }
        };

Where Settings Are Defined
--------------------------

Settings in CARE are persisted in the database and managed through backend WebSocket handlers. They are exposed to the frontend dynamically.

The main logic responsible for handling settings is located at:

- **Backend (WebSocket server)**: ``backend/webserver/sockets/setting.js``  
  This class defines how settings are saved and fetched using:

  .. code-block:: javascript

    this.createSocket("settingGetData", this.getSettings, {}, false)
    this.createSocket("settingSave", this.saveSettings, {}, false);

- **App-wide initialization**: ``backend/webserver/sockets/app.js``  
  On app startup, the method ``sendSettings()`` sends all global and user-specific settings to the frontend.

  .. code-block:: javascript

    const settings = await this.models["setting"].getAll();
    settings.forEach((s) => (returnSettings[s.key] = s.value));

- **Frontend Dashboard UI**: ``frontend/src/components/dashboard/Settings.vue``

    This page shows all defined settings grouped by key namespaces, supports editing, and requires pressing **Save Settings** to persist changes.
