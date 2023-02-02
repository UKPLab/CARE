Extending the Database
======================

Here we explain how you can extend the existing database schema and make new data tables accessible to services and
sockets in the backend of CARE.

The Database in the CARE Backend
--------------------------------

The underlying data store of CARE is a relational database. The `PostgresSQL <https://www.postgresql.org/>`_ database is
managed and accessed via `Sequelize <https://sequelize.org/>`_. The backend services and sockets of CARE access the
database via methods provided in the ``backend/db/methods`` directory, which in turn utilize Sequelize as an layer
of abstraction to query and update the database.

The database is modified via `Sequelize's migration system <https://sequelize.org/docs/v6/other-topics/migrations/>`_.
``make init`` adds any new migrations to the database. Modifying the database schema therefore means adding a new
migration and potentially a new Sequelize model.

.. note::

    Please read up on the details of the database in the background chapter :doc:`Database <../basics/database>`.


Creating a Migration
---------------------
To create a migration ``NAME_OF_MIGRATIN`` you can simply use the sequelize CLI. Enter the ``backend/db`` in your
console and run the following command to generate a new migration with an associated timestamp:


.. code-block:: bash

    npx sequelize migration:generate --name NAME_OF_MIGRATION


.. note::

    Make sure that you have the `Sequelize migration CLI <https://sequelize.org/docs/v6/other-topics/migrations/>`_
    (called npx) installed before creating a new migration. Alternatively, you can also create all files manually,
    but we recommend using the CLI.



Creating a Model
-----------------


Extending the Database Interface
--------------------------------

