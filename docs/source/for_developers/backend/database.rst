Database
========

The underlying data store of CARE is a relational database. The `PostgresSQL <https://www.postgresql.org/>`_ database is
managed and accessed via `Sequelize <https://sequelize.org/>`_. The backend services and sockets of CARE access the
database via predefined methods provided in with the MetaModel class in ``backend/db`` directory, which in turn utilize Sequelize as an layer
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



Adding a New Model
~~~~~~~~~~~~~~~~~~

1. Use the CLI to create a model and a migration file.

.. code-block:: bash

    npx sequelize migration:generate --name <name>-nav

2. In the newly generated migration file under migrations change the table name. It should be
   a singular lower-case term.
3. Now you need to add a new model file for this table. Create a new file in ``backend/db/models``
   that exports a function for generating the model as an instance of a MetaModel from a given
   Sequelize object. This looks as follows for a table called ``simpletable`` (the name introduced in 2.):

.. code-block:: javascript

    'use strict';
    const MetaModel = require("../MetaModel.js");

    module.exports = (sequelize, DataTypes) => {
        class SimpleTable extends MetaModel {
            static associate(models) {
            }
        }

        SimpleTable.init({
            updatedAt: DataTypes.DATE,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE
        }, {
            sequelize: sequelize,
            modelName: 'simpletable',
            tableName: 'simpletable'
        });
        return SimpleTable;
    };


4. Add the foreign keys and constraints to the migration file as desired. For examples check out
   the other migrations. For a very simple table ``simpletable`` this would look like this:

.. code-block:: javascript

    module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('simpletable', {
            id: {
                allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER
            },
            deleted: {
                type: Sequelize.BOOLEAN, defaultValue: false
            },
            createdAt: {
                allowNull: false, type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false, type: Sequelize.DATE
            },
            deletedAt: {
                allowNull: true, defaultValue: null, type: Sequelize.DATE
            }
        });
    }, async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('simpletable');
    }

5. If necessary update the model file accordingly (if fields have been changed). Make sure adding additional columns
   like deleted, createdAt, updatedAt and deletedAt is done in the migration file.

Accessing a Model
~~~~~~~~~~~~~~~~~

The above steps are necessary to create a new migration and associated model. To encapsulate
the database interactions, the ``MetaModel`` class already contains several convenience functions for accessing the
respective table. For instance, getting a single row entry by a provided ID (``getById(id)``). Accessing the DB via
these default functions is as simple as accessing the table model and executing the static method.

.. code-block:: javascript

    // usually, you just access the models loaded in the web server; for completeness we provide the imports here:
    const {DataTypes} = require("sequelize")
    const db = require("./db/index.js")
    const SimpleTable = require("./db/models/simpletable.js")(db.sequelize, DataTypes);

    SimpleTable.getById("x");

.. note::
    Generally you should *not* import the db object yourself and load a model as in the provided example. Instead,
    the web server object already holds the respective models in a class attribute. Please check out the
    :doc:`./socket` for the details.

In case you need more specific functions, you may simply add static access methods to the new model class. For instance:

.. code-block:: javascript

    'use strict';
    const MetaModel = require("../MetaModel.js");

    module.exports = (sequelize, DataTypes) => {
        class SimpleTable extends MetaModel {
            static associate(models) {
            }

            // new access function specific to this model
            static async getDefaultRow() {
                //do error management -- ommitted for brevity
                return await this.findOne({ where: {'id': "x"}, raw: true});
            }
        }
        //... initialization etc.
    };


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




