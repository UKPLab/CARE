Quickstart
==========

Doing research with comments and highlights isn't difficult anymore. Properly configured, you can start using CARE
within a few minutes. Simply follow the :doc:`Installation <./installation>` instructions and visit http://localhost:8080.

If you want to get an high-level overview on CARE and understand what's going on under the hood,
we have compiled this very condensed quickstart guide.


System Architecture
-------------------
The CARE system architecture follows a classical client-server approach split in the three tiers frontend (presentation),
backend (app/logic), and external and data services (data). The frontend is realized as a monolithic Vue3.js application
running in the browser of the clients. The frontend communicates with the backend via websockets requesting and updating
data. The backend runs an express server that listens to client websocket connections and forwards data and service
requests to the last tier. The key component of last tier is the database. The NLP-Service enabling AI-assistance
is also connected to the backend on this last tier.

.. note::
    Check out the :doc:`architecture <for_developers/basics/architecture>` chapter for all the details on the
    different components.

The code is structured accordingly:

.. code-block::

    > backend         # backend logic
      > db            # database management and interaction
      > webserver     # actual server and socket interface

    > frontend        # frontend logic

    > docs            # this documentation


The Frontend
------------
The frontend essentially consists of three major views:

    1. the landing page (view including login etc.)
    2. the dashboard (connecting all other views)
    3. the annotator (view for annotating documents)

All management functionality is realized within the dashboard. If you intend to extend CARE, you usually add new
components here. The annotator includes the sidebar and the actual document. Anything related to document
commenting and highlighting takes place here. If you want to add new annotation features, you would usually extend
the annotator.

Structurally, the frontend architecture is made up of the vuex store (data management), the router (view navigation),
the websocket (communication), and the actual visual components (presentation). If you want to extend the CARE
frontend, you usually need to extend the websocket interface, update the store to include new data, and add the
actual component for visualization.


The Backend
-----------
The backend consists of

    1. the database connection (for DB interaction and management)
    2. the actual webserver (connecting all other parts)
    3. the socket interface (1st tier communication)
    4. the external services (3rd tier communication)

The webserver hosts the actual backend logic and provides the different communication interfaces. If you want to
extend CARE, you generally don't need to touch the webserver; instead, you typically just need to update the database
schema, extend the socket interface or add an external service.


Paradigms
---------
Both frontend and backend follow an event-based design principle. All communication takes place via websockets instead
of HTTP requests and responses to enable this paradigm. This avoids busy waiting, reduces overhead and makes development
for CARE lean and easy. The message format follows a standardized naming schema.

**Frontend**
The frontend is mostly realized using a set of base components which ensure a consistent design and easy and
quick extensibility. All components are realized in Boostrap 5 to ensure a responsive design with wide browser support.

**Backend**
The backend defines a set of standard classes that make the extension of sockets, services and the database very quick.
Rights and access management is kept lean; enforcing access rules lies in the responsibility of the backend.

**Documentation**
The comprehensive documentation should enable usage and extension of the tool. The documentation has to be kept up-to-date
at all times; all components, classes and methods are documented; the socket API documentation is continuously updated.

**Testing**
Automatic testing is focused on the backend using the provided test framework. The frontend undergoes rigorous manual
testing before providing features on the main branch of the tool.