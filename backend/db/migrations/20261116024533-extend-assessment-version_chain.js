'use strict';

/**
 * Keeps the predecessor chain of assessment versions valid with triggers: every live version points at the
 * live version just before it (NULL for the first); a soft delete re-links the successor.
 * The triggers take the same advisory lock as the socket handlers (see utils/helper/assessmentVersions.js).
 * @author Eyad Mohamed
 */
module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});

            await run(`
                CREATE FUNCTION assessment_versioning_chain_guard() RETURNS trigger AS $$
                DECLARE latest integer; expected integer;
                BEGIN
                    PERFORM pg_advisory_xact_lock(1, NEW."assessmentGroupId");
                    IF TG_OP = 'INSERT' THEN
                        SELECT max(id) INTO latest FROM "assessment"
                            WHERE "assessmentGroupId" = NEW."assessmentGroupId" AND "deleted" = false;
                        IF NEW."previousAssessmentVersionId" IS DISTINCT FROM latest THEN
                            RAISE EXCEPTION 'The predecessor of a new assessment version must be the latest active version of its group (%).', latest;
                        END IF;
                        IF latest IS NOT NULL AND latest >= NEW.id THEN
                            RAISE EXCEPTION 'A newer assessment version was created at the same time; retry.'
                                USING ERRCODE = 'serialization_failure';
                        END IF;
                        RETURN NEW;
                    END IF;
                    IF NEW."previousAssessmentVersionId" IS DISTINCT FROM OLD."previousAssessmentVersionId" THEN
                        IF OLD."deleted" OR NEW."deleted" THEN
                            RAISE EXCEPTION 'The predecessor link of a deleted assessment version is kept as history.';
                        END IF;
                        SELECT max(id) INTO expected FROM "assessment"
                            WHERE "assessmentGroupId" = NEW."assessmentGroupId" AND "deleted" = false AND id < NEW.id;
                        IF NEW."previousAssessmentVersionId" IS DISTINCT FROM expected THEN
                            RAISE EXCEPTION 'The predecessor of assessment version % must be the active version just before it (%), not %.',
                                NEW.id, expected, NEW."previousAssessmentVersionId";
                        END IF;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE FUNCTION assessment_versioning_reconnect_chain() RETURNS trigger AS $$
                BEGIN
                    UPDATE "assessment" s SET
                        "previousAssessmentVersionId" = (
                            SELECT max(p.id) FROM "assessment" p
                            WHERE p."assessmentGroupId" = s."assessmentGroupId" AND p."deleted" = false AND p.id < s.id),
                        "updatedAt" = now()
                    WHERE s."previousAssessmentVersionId" = NEW.id AND s."deleted" = false;
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;`);

            await run(`
                CREATE TRIGGER "assessment_chain_guard" BEFORE INSERT OR UPDATE ON "assessment"
                FOR EACH ROW EXECUTE FUNCTION assessment_versioning_chain_guard()`);
            await run(`
                CREATE TRIGGER "assessment_chain_reconnect" AFTER UPDATE ON "assessment"
                FOR EACH ROW WHEN (NEW."deleted" AND NOT OLD."deleted")
                EXECUTE FUNCTION assessment_versioning_reconnect_chain()`);
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const run = (sql) => queryInterface.sequelize.query(sql, {transaction});
            await run('DROP TRIGGER "assessment_chain_reconnect" ON "assessment"');
            await run('DROP TRIGGER "assessment_chain_guard" ON "assessment"');
            await run('DROP FUNCTION assessment_versioning_reconnect_chain()');
            await run('DROP FUNCTION assessment_versioning_chain_guard()');
        });
    },
};
