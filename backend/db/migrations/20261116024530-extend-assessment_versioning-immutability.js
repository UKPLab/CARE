'use strict';

/**
 * Database triggers for the six versioned assessment tables, so raw SQL and ORM shortcuts cannot bypass them:
 *  - content is immutable, an UPDATE may only change `deleted`, `deletedAt`, `updatedAt` (one-way soft deletion)
 *  - link and option rows are inserted only in the transaction that created their parent version
 *    (recorded in the transaction-local setting `assessment_versioning.created_<table>`, not in `xmin`)
 *  - soft deleting a version flags its link and option rows; a referenced version cannot be deleted
 * The triggers are no security boundary: a session that can run arbitrary SQL can disable them.
 * @author Eyad Mohamed
 */

const TABLES = ['assessment', 'rubric', 'criterion', 'assessment_rubric', 'rubric_criterion', 'criterion_scoring_option'];

const LIFECYCLE = ['deleted', 'deletedAt', 'updatedAt'];
// columns an UPDATE may change, per table
const ALLOWED = {assessment: [...LIFECYCLE, 'previousAssessmentVersionId']};

// parent -> [child table, child foreign key]
const CHILDREN = {
    assessment: ['assessment_rubric', 'assessmentId'],
    rubric: ['rubric_criterion', 'rubricId'],
    criterion: ['criterion_scoring_option', 'criterionId'],
};
// referenced version -> [link table, link column] that must hold no live row before it can be deleted
const REFERENCED_BY = {
    rubric: ['assessment_rubric', 'rubricId'],
    criterion: ['rubric_criterion', 'criterionId'],
};
// link table -> [referenced table, link column]
const TARGETS = {
    assessment_rubric: ['rubric', 'rubricId'],
    rubric_criterion: ['criterion', 'criterionId'],
};

const quote = (values) => values.map((value) => `'${value}'`).join(', ');

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});

            await run(`
                CREATE FUNCTION assessment_versioning_guard_update() RETURNS trigger AS $$
                DECLARE allowed text[] := TG_ARGV;
                BEGIN
                    IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
                        RAISE EXCEPTION '% content is immutable; create a new version instead of updating.', TG_TABLE_NAME;
                    END IF;
                    IF OLD."deleted" AND NOT NEW."deleted" THEN
                        RAISE EXCEPTION '% rows cannot be restored once deleted.', TG_TABLE_NAME;
                    END IF;
                    IF OLD."deleted" AND NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
                        RAISE EXCEPTION 'The deletion time of a deleted % row cannot change.', TG_TABLE_NAME;
                    END IF;
                    IF NEW."deleted" AND NEW."deletedAt" IS NULL THEN
                        NEW."deletedAt" := now();
                    END IF;
                    IF NOT NEW."deleted" AND NEW."deletedAt" IS NOT NULL THEN
                        RAISE EXCEPTION 'deletedAt is only set on deleted % rows.', TG_TABLE_NAME;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_flag_children() RETURNS trigger AS $$
                BEGIN
                    EXECUTE format(
                        'UPDATE %I SET "deleted" = $1, "deletedAt" = $2, "updatedAt" = $3 WHERE %I = $4 AND "deleted" = false',
                        TG_ARGV[0], TG_ARGV[1])
                        USING NEW."deleted", NEW."deletedAt", NEW."updatedAt", NEW.id;
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_reject_orphan_flag() RETURNS trigger AS $$
                DECLARE parent_deleted boolean;
                BEGIN
                    EXECUTE format('SELECT "deleted" FROM %I WHERE id = ($1).%I', TG_ARGV[0], TG_ARGV[1])
                        INTO parent_deleted USING NEW;
                    IF parent_deleted IS DISTINCT FROM true THEN
                        RAISE EXCEPTION '% rows are deleted together with their version, never one by one.', TG_TABLE_NAME;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_reject_referenced_delete() RETURNS trigger AS $$
                DECLARE referencing integer;
                BEGIN
                    -- FOR UPDATE conflicts with the key-share lock of a link insert that is still running
                    EXECUTE format('SELECT 1 FROM %I WHERE id = $1 FOR UPDATE', TG_TABLE_NAME) USING OLD.id;
                    EXECUTE format('SELECT count(*) FROM %I WHERE %I = $1 AND "deleted" = false', TG_ARGV[0], TG_ARGV[1])
                        INTO referencing USING OLD.id;
                    IF referencing > 0 THEN
                        RAISE EXCEPTION '% version % is still referenced by % live row(s) of %.',
                            TG_TABLE_NAME, OLD.id, referencing, TG_ARGV[0]
                            USING ERRCODE = 'foreign_key_violation';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_reject_deleted_target() RETURNS trigger AS $$
                DECLARE target_deleted boolean;
                BEGIN
                    EXECUTE format('SELECT "deleted" FROM %I WHERE id = ($1).%I FOR KEY SHARE', TG_ARGV[0], TG_ARGV[1])
                        INTO target_deleted USING NEW;
                    IF target_deleted IS TRUE THEN
                        RAISE EXCEPTION '% cannot reference a deleted %.', TG_TABLE_NAME, TG_ARGV[0]
                            USING ERRCODE = 'foreign_key_violation';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_register_created() RETURNS trigger AS $$
                DECLARE setting text := 'assessment_versioning.created_' || TG_TABLE_NAME;
                BEGIN
                    PERFORM set_config(setting, coalesce(nullif(current_setting(setting, true), ''), '|') || NEW.id || '|', true);
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_reject_late_insert() RETURNS trigger AS $$
                DECLARE parent_id text := to_jsonb(NEW) ->> TG_ARGV[1]; parent_deleted boolean; created_here boolean;
                BEGIN
                    EXECUTE format('SELECT "deleted" FROM %I WHERE id = ($1).%I', TG_ARGV[0], TG_ARGV[1])
                        INTO parent_deleted USING NEW;
                    IF parent_deleted IS TRUE THEN
                        RAISE EXCEPTION '% rows cannot be added to a deleted version.', TG_TABLE_NAME;
                    END IF;
                    created_here := position('|' || parent_id || '|' in
                        coalesce(current_setting('assessment_versioning.created_' || TG_ARGV[0], true), '')) > 0;
                    IF parent_deleted IS FALSE AND NOT created_here THEN
                        RAISE EXCEPTION '% rows can only be added while the version is created (same transaction); create a new version instead.', TG_TABLE_NAME;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
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
                $$ LANGUAGE plpgsql;`);

            for (const table of TABLES) {
                await run(
                    `CREATE TRIGGER "${table}_guard_update" BEFORE UPDATE ON "${table}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_guard_update(${quote(ALLOWED[table] || LIFECYCLE)})`);
            }
            for (const [parent, [child, column]] of Object.entries(CHILDREN)) {
                await run(
                    `CREATE TRIGGER "${parent}_register_created" AFTER INSERT ON "${parent}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_register_created()`);
                await run(
                    `CREATE TRIGGER "${parent}_flag_children" AFTER UPDATE ON "${parent}"
                     FOR EACH ROW WHEN (OLD."deleted" IS DISTINCT FROM NEW."deleted")
                     EXECUTE FUNCTION assessment_versioning_flag_children('${child}', '${column}')`);
                await run(
                    `CREATE TRIGGER "${child}_reject_orphan_flag" BEFORE UPDATE ON "${child}"
                     FOR EACH ROW WHEN (NEW."deleted" AND NOT OLD."deleted")
                     EXECUTE FUNCTION assessment_versioning_reject_orphan_flag('${parent}', '${column}')`);
                await run(
                    `CREATE TRIGGER "${child}_no_late_insert" BEFORE INSERT ON "${child}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_late_insert('${parent}', '${column}')`);
                await run(
                    `CREATE TRIGGER "${child}_no_orphan_delete" BEFORE DELETE ON "${child}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_orphan_delete('${parent}', '${column}')`);
            }
            for (const [target, [link, column]] of Object.entries(REFERENCED_BY)) {
                await run(
                    `CREATE TRIGGER "${target}_reject_referenced_delete" BEFORE UPDATE ON "${target}"
                     FOR EACH ROW WHEN (NEW."deleted" AND NOT OLD."deleted")
                     EXECUTE FUNCTION assessment_versioning_reject_referenced_delete('${link}', '${column}')`);
            }
            for (const [link, [target, column]] of Object.entries(TARGETS)) {
                await run(
                    `CREATE TRIGGER "${link}_reject_deleted_target" BEFORE INSERT ON "${link}"
                     FOR EACH ROW EXECUTE FUNCTION assessment_versioning_reject_deleted_target('${target}', '${column}')`);
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});

            for (const link of Object.keys(TARGETS)) {
                await run(`DROP TRIGGER "${link}_reject_deleted_target" ON "${link}"`);
            }
            for (const target of Object.keys(REFERENCED_BY)) {
                await run(`DROP TRIGGER "${target}_reject_referenced_delete" ON "${target}"`);
            }
            for (const [parent, [child]] of Object.entries(CHILDREN)) {
                await run(`DROP TRIGGER "${child}_no_orphan_delete" ON "${child}"`);
                await run(`DROP TRIGGER "${child}_no_late_insert" ON "${child}"`);
                await run(`DROP TRIGGER "${child}_reject_orphan_flag" ON "${child}"`);
                await run(`DROP TRIGGER "${parent}_flag_children" ON "${parent}"`);
                // IF EXISTS: a database migrated before the xmin fix (see the header) has no such trigger
                await run(`DROP TRIGGER IF EXISTS "${parent}_register_created" ON "${parent}"`);
            }
            for (const table of TABLES) {
                await run(`DROP TRIGGER "${table}_guard_update" ON "${table}"`);
            }
            for (const fn of ['guard_update', 'flag_children', 'reject_orphan_flag', 'reject_referenced_delete',
                'reject_deleted_target', 'register_created', 'reject_late_insert', 'reject_orphan_delete']) {
                await run(`DROP FUNCTION ${fn === 'register_created' ? 'IF EXISTS ' : ''}assessment_versioning_${fn}()`);
            }
        });
    },
};
