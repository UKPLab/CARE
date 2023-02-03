Database
========

The underlying data store of CARE is a relational database. The `PostgresSQL <https://www.postgresql.org/>`_ database is
managed and accessed via `Sequelize <https://sequelize.org/>`_. The backend services and sockets of CARE access the
database via methods provided in the ``backend/db/methods`` directory, which in turn utilize Sequelize as an layer
of abstraction to query and update the database.

The database schema is modified via `Sequelize's migration system <https://sequelize.org/docs/v6/other-topics/migrations/>`_.
``make init`` adds any new migrations to the database. Modifying the database schema therefore means adding a new
migration and potentially a new Sequelize model.

All relevant files can be found in the ``backend/db`` folder.

Models
------

Models are defined in the ``models`` folder.
They are defined using the `Sequelize <http://docs.sequelizejs.com/>`_ ORM.

The following entity relationship model (ERM) shows the relations between the different models:

.. image:: ./ERM.drawio.svg
   :width: 100%
   :align: center

Additionally, the following attributes are added to each table:

- ``deleted``: Boolean indicating whether the entry is deleted or not.
- ``createdAt``: The time when the entry was created.
- ``updatedAt``: The time when the entry was last updated.
- ``deletedAt``: The time when the entry was deleted.

Migrations
----------

Working with migrations is done using the `Sequelize CLI <https://sequelize.org/docs/v6/other-topics/migrations/>`_.

To install the CLI, run ``npm install --save-dev sequelize-cli`` inside of the db folder.
After that, you can run ``npx sequelize --help`` to see all available commands.

To create a new migration, run ``npx sequelize migration:generate --name <name>``.
This will create a new file in the ``migrations`` folder, containing a ``up`` and a ``down`` function.



Adding a new model
~~~~~~~~~~~~~~~~~~

1. Use the CLI to create a model and a migration file.

.. code-block:: bash

    npx sequelize-cli model:generate --name <tablename> --attributes attribute1:type1,...,attributeN:typeN

2. In the newly generated migration file under migrations change the table name. It should be
   a singular lower-case term.
3. Add this table name under the newly generated model file in the models directory to the init options:

.. code-block:: javascript

    tableName: '<name>'


4. Add the foreign keys and constraints to the migration file as desired. For examples check out
   the other migrations.
5. If necessary update the model file accordingly (if fields have been changed). Make sure adding additional columns like deleted, createdAt, updatedAt and deletedAt is done in the migration file.

The above steps are necessary to create a new migration and associated model. To encapsulate
the database interactions, the directory "methods" contains interface methods for each of the models.
If you created a new migration for a new table, please follow these additional steps:

1. Create a new file "methods/<modelname>.js"
2. Add the header for importing the model definition

.. code-block:: javascript

    const {DataTypes, Op} = require("sequelize")
    const db = require("../models/index.js")

    const ModelName = require("../models/<modelname>.js")(db.sequelize, DataTypes);

3. Export the interface functions by adding them to the export object. To ensure consistency
all functions that interact with the database should be async functions. Also, ensure
proper error management, i.e. catching DB connection errors etc. Hence, do not return
the sequelize Promise directly, instead await them and encapsulate them with a try-catch-block.

.. code-block:: javascript

    exports.funName = async function funName(document_id, user_id) {
    //...
    }

Populating a Table
~~~~~~~~~~~~~~~~~~

To populate a table with basic data rows, you can use seeds to test and debug and then
convert it into a regular migration.

1. Create a seeder

.. code-block:: bash

    npx sequelize-cli seed:generate --name <seeder-name>

2. Adapt the seeder in the respective file under directory "seeders".
3. Move it to the migrations folder.
4. Double check that you have set the down method accordingly -- you don't want
   to drop an entire table if you only add a few rows. Delete just these rows.




