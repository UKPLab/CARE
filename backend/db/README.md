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


