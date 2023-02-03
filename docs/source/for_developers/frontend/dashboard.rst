Dashboard
=======================

Dashboard Structure
-------------------
The dashboard is the centerpiece of the CARE frontend. Adding new management features generally means adding a new
dashboard component. A dashboard component consists of three ingredients: a *configuration in the database*, the actual
*vue component* and a *sub-route* in the vue app.

The configuration in the database defines who may see the component and how it should be listed in the dashboard. The
actual vue component describes, as usually, the UI and functionality in the frontend. The sub-route, which is also part
of the configuration, assigns a unique path to the component allowing to exploit vue routing features.

The dashboard vue components are all specified as components in ``frontend/src/components/dashboard``. The
dashboard loads its components dynamically depending on the settings and user rights. Likewise, the
dashboard sidebar is populated based on the sidebar settings loaded from the database. Each component that is visible
to the specific user and configured in the settings is added here with an icon and the respective name.


Adding a New Dashboard Component
--------------------------------
TBA


Populating a Dashboard Component
------------------------------------
TBA

