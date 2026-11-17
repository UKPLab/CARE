'use strict';

/**
 * Guards the writers of assessment references that live in JSON (study_step, trigger, trigger_action,
 * trigger_queue): a trigger takes `FOR KEY SHARE` on each referenced live assessment version and refuses a missing
 * or deleted one. The delete takes `FOR UPDATE` first, so exactly one of the two wins.
 * See backend/utils/helper/assessmentReferences.js for the recognised JSON shapes.
 * @author Eyad Mohamed
 */

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});

            // same JSON shapes as the reference check of the delete
            await run(`
                CREATE FUNCTION assessment_json_reference_ids(cfg jsonb) RETURNS SETOF bigint AS $$
                    SELECT DISTINCT id FROM (
                        SELECT CASE
                            WHEN jsonb_typeof(v) = 'number'
                                 AND (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
                                 AND (v #>> '{}')::numeric BETWEEN 1 AND 9223372036854775807
                                THEN (v #>> '{}')::numeric::bigint
                            WHEN jsonb_typeof(v) = 'string' AND (v #>> '{}') ~ '^[1-9][0-9]{0,17}$'
                                THEN (v #>> '{}')::bigint
                        END AS id
                        FROM (
                            SELECT jsonb_path_query(cfg, '$.**.assessmentId[*]') AS v
                            UNION ALL
                            SELECT jsonb_path_query(cfg, '$.** ? (@.table == "assessment").fileIds[*]')
                        ) found
                    ) ids WHERE id IS NOT NULL
                $$ LANGUAGE sql STABLE;`);

            await run(`
                CREATE FUNCTION assessment_reference_guard() RETURNS trigger AS $$
                DECLARE
                    ref_id bigint;
                    old_ids bigint[] := '{}';
                    new_counts boolean;
                    old_counts boolean;
                BEGIN
                    IF TG_TABLE_NAME = 'study_step' THEN
                        new_counts := true;
                    ELSIF TG_TABLE_NAME = 'trigger_queue' THEN
                        new_counts := NOT COALESCE(NEW."deleted", false) AND COALESCE(NEW."status" IN (0, 1), false);
                    ELSE
                        new_counts := NOT COALESCE(NEW."deleted", false);
                    END IF;
                    IF NOT new_counts THEN
                        RETURN NEW;
                    END IF;

                    IF TG_OP = 'UPDATE' THEN
                        IF TG_TABLE_NAME = 'study_step' THEN
                            old_counts := true;
                        ELSIF TG_TABLE_NAME = 'trigger_queue' THEN
                            old_counts := NOT COALESCE(OLD."deleted", false) AND COALESCE(OLD."status" IN (0, 1), false);
                        ELSE
                            old_counts := NOT COALESCE(OLD."deleted", false);
                        END IF;
                        IF old_counts THEN
                            old_ids := ARRAY(SELECT assessment_json_reference_ids(OLD."configuration"));
                        END IF;
                    END IF;

                    FOR ref_id IN SELECT assessment_json_reference_ids(NEW."configuration") ORDER BY 1 LOOP
                        CONTINUE WHEN ref_id = ANY(old_ids);
                        PERFORM 1 FROM "assessment" WHERE id = ref_id AND "deleted" = false FOR KEY SHARE;
                        IF NOT FOUND THEN
                            RAISE EXCEPTION 'Assessment version % does not exist or was deleted, so % cannot reference it.', ref_id, TG_TABLE_NAME
                                USING ERRCODE = 'foreign_key_violation';
                        END IF;
                    END LOOP;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            const triggers = [
                ['study_step', 'configuration'],
                ['trigger', 'configuration, "deleted"'],
                ['trigger_action', 'configuration, "deleted"'],
                ['trigger_queue', 'configuration, "deleted", "status"'],
            ];
            for (const [table, columns] of triggers) {
                await run(`
                    CREATE TRIGGER ${table}_assessment_reference_guard
                        BEFORE INSERT OR UPDATE OF ${columns} ON "${table}"
                        FOR EACH ROW EXECUTE FUNCTION assessment_reference_guard();`);
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});
            for (const table of ['study_step', 'trigger', 'trigger_action', 'trigger_queue']) {
                await run(`DROP TRIGGER IF EXISTS ${table}_assessment_reference_guard ON "${table}";`);
            }
            await run('DROP FUNCTION IF EXISTS assessment_reference_guard();');
            await run('DROP FUNCTION IF EXISTS assessment_json_reference_ids(jsonb);');
        });
    },
};
