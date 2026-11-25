'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    /**
     * Stored answers for REST requests sent with an Idempotency-Key header. Short-lived cache
     * rows, not user data: middleware/restIdempotency.js removes them after 24 hours.
     */
    class ApiIdempotencyKey extends MetaModel {
        // Stored responses must not reach browsers through table broadcasts.
        static autoTable = false;
        static fields = [];
        static accessMap = [];
    }

    ApiIdempotencyKey.init({
        id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
        userId: {type: DataTypes.INTEGER, allowNull: false},
        idempotencyKey: {type: DataTypes.STRING, allowNull: false},
        method: {type: DataTypes.STRING, allowNull: false},
        path: {type: DataTypes.STRING, allowNull: false},
        requestHash: {type: DataTypes.STRING, allowNull: false},
        statusCode: {type: DataTypes.INTEGER, allowNull: true},
        responseBody: {type: DataTypes.JSONB, allowNull: true},
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'api_idempotency_key',
        tableName: 'api_idempotency_key',
    });

    return ApiIdempotencyKey;
};
