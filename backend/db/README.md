## Database Management

### Pre-requistis
The Sequelize CLI and Sequelize are installed.

```bash
npm install sequelize-cli
```

### Adding a New Table
Assuming your working directory is db. Assuming the database server has been started.


1. Use the CLI to create a model and a migration file.
```bash
npx sequelize-cli model:generate --name <tablename> --attributes attribute1:type1,...,attributeN:typeN
```
2. In the newly generated migration file under migrations change the table name. It should be
   a singular lower-case term.
3. Add this table name under the newly generated model file in the models directory to the init options:
```js
tableName: '<name>'
```
4. Add the foreign keys and constraints to the migration file as desired. For examples check out
   the other migrations.
5. If necessary update the model file accordingly (if fields have been changed). If you kept the
   automatically generated fields (updatedAt), you should add them
   to the model file, too.

The above steps are necessary to create a new migration and associated model. To encapsulate
the database interactions, the directory "methods" contains interface methods for each of the models.
If you created a new migration for a new table, please follow these additional steps:

1. Create a new file "methods/<modelname>.js"
2. Add the header for importing the model definition
```js
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")

const ModelName = require("../models/<modelname>.js")(db.sequelize, DataTypes);
```
3. Export the interface functions by adding them to the export object. To ensure consistency
all functions that interact with the database should be async functions. Also, ensure
proper error management, i.e. catching DB connection errors etc. Hence, do not return
the sequelize Promise directly, instead await them and encapsulate them with a try-catch-block.
```js
exports.funName = async function funName(document_id, user_id) {
    //...
}
```

### Populating a Table
To populate a table with basic data rows, you can use seeds to test and debug and then
convert it into a regular migration.

1. Create a seeder
```shell
npx sequelize-cli seed:generate --name <seeder-name>
```

2. Adapt the seeder in the respective file under directory "seeders".
3. Move it to the migrations folder.
4. Double check that you have set the down method accordingly -- you don't want
   to drop an entire table if you only add a few rows. Delete just these rows.