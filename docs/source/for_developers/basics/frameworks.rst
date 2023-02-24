Frameworks
==========

Here we give a rough overview of the frameworks used in this application.
This is not intended to be a guide for usage (these can be found under the respective link),
but to highlight the special aspects in relation to development in this application.

There are a few fundamental frameworks that are used in frontend and backend:

* `Socket.IO <http://socket.io/>`_ for real-time communication between the frontend and backend


Frontend
--------

The frontend is based on the VueJS framework and uses the following additional libraries:

* `Vue 3 <https://vuejs.org>`_ - Progressive JavaScript Framework
* `Vuex <https://vuex.vuejs.org>`_ - State Management Pattern + Library
* `Vue Router <https://router.vuejs.org>`_ - Routing for Vue.js
* `Socket.io for Vue <https://www.npmjs.com/package/vue-3-socket.io>`_ - Socket.io for Vue 3
* `Bootstrap 5 for Vue <https://www.npmjs.com/package/bootstrap-vue-3>`_ - Bootstrap 5  for Vue 3
* `Vite <https://vitejs.dev/>`_ - Next Generation Frontend Tooling (for building the frontend)

In addition to the above, the frontend uses further libraries not directly related to VueJS:

* `PDFjs <https://mozilla.github.io/pdf.js/>`_ - PDF Viewer
* `Bootstrap 5 <https://getbootstrap.com/>`_ - Responsive frontend toolkit
* `Bootstrap Icons <https://icons.getbootstrap.com/>`_ - Bootstrap Icons

Backend
-------

Currently the database in the backend is based on PostgreSQL,
while the binding is established with Sequelize,
which enables the exchange of the database:

* `PostgreSQL <https://www.postgresql.org/>`_ - Relational Database
* `Sequelize <https://sequelize.org/>`_ - Database Management System

To provide the server itself we use ExpressJS, extended by the PassportJS library for authentication:

* `ExpressJS <https://expressjs.com/>`_ - Web Framework for Node.js
* `PassportJS <http://www.passportjs.org/>`_ - Authentication Middleware for Node.js




