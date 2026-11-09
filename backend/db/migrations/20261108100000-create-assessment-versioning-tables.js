'use strict';

/**
 * Database-backed, versioned assessments (assessment -> rubric -> criterion -> scoring option).
 *
 * Every version is its own row. Versions of one logical entity share a numeric group id that is
 * drawn from a sequence, so it stays valid when the first version is deleted. Versions are
 * immutable and hard-deleted. Triggers enforce this:
 *  - every UPDATE is rejected;
 *  - a link or option row can only be inserted in the transaction that created its parent version
 *    (PostgreSQL's xmin = the creating transaction), so a committed version can never gain rows;
 *  - a link or option row can only be deleted together with its parent version.
 * Create a version and all of its rows in one transaction.
 *
 * Foreign keys decide whether a version may be deleted:
 *  - referenced side (rubric_id / criterion_id in the link tables): RESTRICT
 *  - owning side (assessment_id, rubric_id of rubric_criterion, criterion_id of scoring option): CASCADE
 *
 * The existing `configuration` table is not touched.
 */

const SEQUENCES = {
    assessment: 'assessment_group_id_seq',
    rubric: 'rubric_group_id_seq',
    criterion: 'criterion_group_id_seq',
};

const TABLES = ['assessment', 'rubric', 'criterion', 'assessment_rubric', 'rubric_criterion', 'criterion_scoring_option'];

// child table -> [parent table, foreign key column]
const OWNED_BY = {
    assessment_rubric: ['assessment', 'assessmentId'],
    rubric_criterion: ['rubric', 'rubricId'],
    criterion_scoring_option: ['criterion', 'criterionId'],
};

const id = (Sequelize) => ({
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
});

const reference = (Sequelize, model, onDelete) => ({
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {model, key: 'id'},
    onUpdate: 'CASCADE',
    onDelete,
});

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // Sequelize has no sequence API; names are constants, no user input involved.
            for (const sequence of Object.values(SEQUENCES)) {
                await queryInterface.sequelize.query(`CREATE SEQUENCE "${sequence}"`, {transaction});
            }

            const groupId = (sequence) => ({
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: Sequelize.literal(`nextval('"${sequence}"')`),
            });
            const createdAt = {allowNull: false, type: Sequelize.DATE};

            await queryInterface.createTable('assessment', {
                id: id(Sequelize),
                assessmentGroupId: groupId(SEQUENCES.assessment),
                versionNumber: {type: Sequelize.STRING, allowNull: false},
                name: {type: Sequelize.STRING, allowNull: false},
                description: {type: Sequelize.TEXT, allowNull: false},
                createdAt,
            }, {transaction});

            await queryInterface.createTable('rubric', {
                id: id(Sequelize),
                rubricGroupId: groupId(SEQUENCES.rubric),
                versionNumber: {type: Sequelize.STRING, allowNull: false},
                name: {type: Sequelize.STRING, allowNull: false},
                description: {type: Sequelize.TEXT, allowNull: false},
                minPoints: {type: Sequelize.DECIMAL, allowNull: false},
                maxPoints: {type: Sequelize.DECIMAL, allowNull: false},
                // sum | min | max (utils/modules/assessment-score); some existing rubrics omit it, stored as NULL
                calculation: {type: Sequelize.STRING, allowNull: true},
                // start value of "max" rubrics; absent for the other methods
                defaultPoints: {type: Sequelize.DECIMAL, allowNull: true},
                isBonus: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
                createdAt,
            }, {transaction});

            await queryInterface.createTable('criterion', {
                id: id(Sequelize),
                criterionGroupId: groupId(SEQUENCES.criterion),
                versionNumber: {type: Sequelize.STRING, allowNull: false},
                name: {type: Sequelize.STRING, allowNull: false},
                description: {type: Sequelize.TEXT, allowNull: false},
                minPoints: {type: Sequelize.DECIMAL, allowNull: true},
                maxPoints: {type: Sequelize.DECIMAL, allowNull: true},
                // grading function, e.g. auto_grading; null for plain manual criteria
                function: {type: Sequelize.STRING, allowNull: true},
                subjective: {type: Sequelize.BOOLEAN, allowNull: false},
                // same integer as the configuration JSON (0, 1 or 2 in the existing data)
                expertLevel: {type: Sequelize.INTEGER, allowNull: false},
                createdAt,
            }, {transaction});

            await queryInterface.createTable('assessment_rubric', {
                id: id(Sequelize),
                assessmentId: reference(Sequelize, 'assessment', 'CASCADE'),
                rubricId: reference(Sequelize, 'rubric', 'RESTRICT'),
                rubricPositionInAssessment: {type: Sequelize.INTEGER, allowNull: false},
            }, {transaction});

            // rubric_criterion.id is the criterion occurrence id used when storing results
            await queryInterface.createTable('rubric_criterion', {
                id: id(Sequelize),
                rubricId: reference(Sequelize, 'rubric', 'CASCADE'),
                criterionId: reference(Sequelize, 'criterion', 'RESTRICT'),
                criterionPositionInRubric: {type: Sequelize.INTEGER, allowNull: false},
            }, {transaction});

            await queryInterface.createTable('criterion_scoring_option', {
                id: id(Sequelize),
                criterionId: reference(Sequelize, 'criterion', 'CASCADE'),
                // negative points are valid (deduction criteria)
                points: {type: Sequelize.DECIMAL, allowNull: false},
                description: {type: Sequelize.TEXT, allowNull: false},
                position: {type: Sequelize.INTEGER, allowNull: false},
            }, {transaction});

            const unique = (table, fields, name) =>
                queryInterface.addConstraint(table, {type: 'unique', fields, name, transaction});
            const check = (table, where, name) =>
                queryInterface.addConstraint(table, {type: 'check', fields: [], where, name, transaction});

            await unique('assessment', ['assessmentGroupId', 'versionNumber'], 'assessment_group_version_unique');
            await unique('rubric', ['rubricGroupId', 'versionNumber'], 'rubric_group_version_unique');
            await unique('criterion', ['criterionGroupId', 'versionNumber'], 'criterion_group_version_unique');
            await unique('assessment_rubric', ['assessmentId', 'rubricId'], 'assessment_rubric_rubric_unique');
            await unique('assessment_rubric', ['assessmentId', 'rubricPositionInAssessment'], 'assessment_rubric_position_unique');
            await unique('rubric_criterion', ['rubricId', 'criterionId'], 'rubric_criterion_criterion_unique');
            await unique('rubric_criterion', ['rubricId', 'criterionPositionInRubric'], 'rubric_criterion_position_unique');
            await unique('criterion_scoring_option', ['criterionId', 'position'], 'criterion_scoring_option_position_unique');

            await check('rubric', Sequelize.literal('"minPoints" <= "maxPoints"'), 'rubric_points_range_check');
            await check('criterion', Sequelize.literal('"minPoints" IS NULL OR "maxPoints" IS NULL OR "minPoints" <= "maxPoints"'), 'criterion_points_range_check');

            // Reference checks ("is this version used?") look up the referenced side; the unique
            // constraints above already cover lookups by the owning side.
            await queryInterface.addIndex('assessment_rubric', ['rubricId'], {transaction});
            await queryInterface.addIndex('rubric_criterion', ['criterionId'], {transaction});

            // Immutability lives in the database: Sequelize has no hook for increment() or raw SQL.
            // Sequelize cannot create triggers, so this is raw SQL (constants only, no user input).
            await queryInterface.sequelize.query(`
                CREATE FUNCTION assessment_versioning_reject_update() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION '% rows are immutable; create a new version instead of updating.', TG_TABLE_NAME;
                END;
                $$ LANGUAGE plpgsql;`, {transaction});
            // A link or option row may only disappear together with its parent version. The
            // ON DELETE CASCADE delete runs after the parent row is gone, so it passes.
            await queryInterface.sequelize.query(`
                CREATE FUNCTION assessment_versioning_reject_orphan_delete() RETURNS trigger AS $$
                DECLARE parent_exists boolean;
                BEGIN
                    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = ($1).%I)', TG_ARGV[0], TG_ARGV[1])
                        INTO parent_exists USING OLD;
                    IF parent_exists THEN
                        RAISE EXCEPTION '% rows are immutable; delete the whole version instead.', TG_TABLE_NAME;
                    END IF;
                    RETURN OLD;
                END;
                $$ LANGUAGE plpgsql;`, {transaction});
            // A row's xmin is the transaction that inserted it. A parent version created by an
            // earlier, committed transaction is finished and takes no more rows. A missing parent
            // is left to the foreign key to report.
            await queryInterface.sequelize.query(`
                CREATE FUNCTION assessment_versioning_reject_late_insert() RETURNS trigger AS $$
                DECLARE created_here boolean;
                BEGIN
                    EXECUTE format('SELECT xmin = pg_current_xact_id()::xid FROM %I WHERE id = ($1).%I', TG_ARGV[0], TG_ARGV[1])
                        INTO created_here USING NEW;
                    IF created_here IS FALSE THEN
                        RAISE EXCEPTION '% rows can only be added while the version is created (same transaction); create a new version instead.', TG_TABLE_NAME;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`, {transaction});

            for (const table of TABLES) {
                await queryInterface.sequelize.query(
                    `CREATE TRIGGER "${table}_immutable" BEFORE UPDATE ON "${table}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_update()`, {transaction});
            }
            for (const [table, [parent, column]] of Object.entries(OWNED_BY)) {
                await queryInterface.sequelize.query(
                    `CREATE TRIGGER "${table}_no_orphan_delete" BEFORE DELETE ON "${table}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_orphan_delete('${parent}', '${column}')`, {transaction});
                await queryInterface.sequelize.query(
                    `CREATE TRIGGER "${table}_no_late_insert" BEFORE INSERT ON "${table}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_late_insert('${parent}', '${column}')`, {transaction});
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const table of ['criterion_scoring_option', 'rubric_criterion', 'assessment_rubric', 'criterion', 'rubric', 'assessment']) {
                await queryInterface.dropTable(table, {transaction});
            }
            await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS assessment_versioning_reject_update()', {transaction});
            await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS assessment_versioning_reject_orphan_delete()', {transaction});
            await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS assessment_versioning_reject_late_insert()', {transaction});
            for (const sequence of Object.values(SEQUENCES)) {
                await queryInterface.sequelize.query(`DROP SEQUENCE IF EXISTS "${sequence}"`, {transaction});
            }
        });
    },
};
