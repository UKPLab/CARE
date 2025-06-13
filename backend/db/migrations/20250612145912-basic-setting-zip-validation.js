'use strict';

const defaultZipSchema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "LaTeX source package template", 
    "description": "Rules that every uploaded ZIP must satisfy.",
    "type": "object",
    "properties": {
        "required": { "type": "array", "items": { "type": "string" } },
        "forbidden": { "type": "array", "items": { "type": "string" } },
        "allowedExtensions": { "type": "array", "items": { "type": "string", "pattern": "^\\.[a-z0-9]+$" } },
        "maxFileCount": { "type": "integer", "minimum": 1 },
        "maxTotalSize": { "type": "integer", "minimum": 0 }
    },
    "required": ["required"],
    "additionalProperties": false
};

const settings = [{
    key: "upload.zip.validationSchema",
    value: JSON.stringify(defaultZipSchema),
    type: "json",
    description: "JSON Schema for ZIP file validation",
    onlyAdmin: true
}];

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check for existing settings to avoid primary key conflicts
        for (const setting of settings) {
            const existing = await queryInterface.rawSelect('setting', {
                where: { key: setting.key }
            }, ['key']);

            if (!existing) {
                await queryInterface.bulkInsert('setting', [{
                    ...setting,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            }
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});
    }
}; 