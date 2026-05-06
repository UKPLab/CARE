'use strict';

/**
 * Move Socket Profiler nav element into the Manage group.
 *
 * The original `extend-nav-socket-profiler` migration (March 22, 2026)
 * inserted Socket Profiler into groupId 2 (Admin). The later
 * `restructure-nav_group` migration (April 25, 2026) replaced the old
 * Admin-centric layout with category-based groups (Home, Study, Manage,
 * Settings, AI), but didn't touch Socket Profiler because it lived on
 * a separate feature branch at the time.
 *
 * After merge, Socket Profiler ends up stranded in the legacy Admin group.
 * This migration relocates it into Manage, alongside other admin
 * operational tools like Users.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Look up Manage group's id by name (don't hard-code 5; safer if IDs ever shift).
        const [groups] = await queryInterface.sequelize.query(
            `SELECT id FROM nav_group WHERE name = 'Manage' LIMIT 1`
        );
        if (!groups || groups.length === 0) {
            // Manage group missing — bail out silently rather than failing migration.
            return;
        }
        const manageId = groups[0].id;

        await queryInterface.sequelize.query(
            `UPDATE nav_element SET "groupId" = :manageId, "updatedAt" = NOW()
             WHERE name = 'Socket Profiler'`,
            { replacements: { manageId } }
        );
    },

    async down(queryInterface, Sequelize) {
        // Revert to the legacy Admin group (id 2 in the pre-restructure schema).
        // If Admin no longer exists for any reason, do nothing.
        const [groups] = await queryInterface.sequelize.query(
            `SELECT id FROM nav_group WHERE name = 'Admin' LIMIT 1`
        );
        if (!groups || groups.length === 0) return;
        const adminId = groups[0].id;

        await queryInterface.sequelize.query(
            `UPDATE nav_element SET "groupId" = :adminId, "updatedAt" = NOW()
             WHERE name = 'Socket Profiler'`,
            { replacements: { adminId } }
        );
    },
};