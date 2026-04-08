'use strict';

function getFirstPresentValue(source, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (Array.isArray(value) && value.length > 0 && value[0]) {
            return value[0];
        }
        if (value) return value;
    }
    return null;
}

function getProvisionedNameParts({ firstName, lastName, email, fullName, fallbackFirstName, fallbackLastName }) {
    const normalizedFirstName = Array.isArray(firstName) ? firstName[0] : firstName;
    const normalizedLastName = Array.isArray(lastName) ? lastName[0] : lastName;
    const toDisplayNamePart = (value, fallback) => {
        if (!value) return fallback;
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    if (normalizedFirstName && normalizedLastName) {
        return { firstName: normalizedFirstName, lastName: normalizedLastName };
    }

    if (email) {
        const localPart = (email || '').split('@')[0] || '';
        const [rawFirstName, ...rest] = localPart.split('.').filter(Boolean);
        const rawLastName = rest.join('.');
        return {
            firstName: normalizedFirstName || toDisplayNamePart(rawFirstName, fallbackFirstName),
            lastName: normalizedLastName || toDisplayNamePart(rawLastName, fallbackLastName),
        };
    }

    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
        firstName: normalizedFirstName || toDisplayNamePart(parts[0], fallbackFirstName),
        lastName: normalizedLastName || toDisplayNamePart(parts.slice(1).join(' '), fallbackLastName),
    };
}

async function findOrProvisionExternalUser(server, { externalField, externalValue, email, createData }) {
    let user = await server.db.models['user'].findOne({ where: { [externalField]: externalValue }, raw: true });

    if (!user && email) {
        user = await server.db.models['user'].findOne({ where: { email }, raw: true });
        if (user) {
            const updateData = { [externalField]: externalValue };
            if (email) updateData.email = email;
            await server.db.models['user'].update(updateData, { where: { id: user.id } });
            user = { ...user, ...updateData };
        }
    }

    if (user) return user;

    const transaction = await server.db.models['user'].sequelize.transaction();
    try {
        const createdUser = await server.db.models['user'].add({
            ...createData,
            [externalField]: externalValue,
            email: email || createData?.email || null,
        }, { transaction });
        await transaction.commit();
        return createdUser?.get ? createdUser.get({ plain: true }) : createdUser;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    findOrProvisionExternalUser,
    getFirstPresentValue,
    getProvisionedNameParts,
};
