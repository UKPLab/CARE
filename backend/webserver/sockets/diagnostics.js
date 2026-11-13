"use strict";
const Socket = require('../Socket');
const TranslatableError = require('../../utils/TranslatableError');
const {collectDiagnostics} = require('../../db/diagnostics');
class DiagnosticsSocket extends Socket {
    async getDiagnostics() {
        if (!(await this.isAdmin())) throw new TranslatableError('errors.users.adminAccessRequired');
        return collectDiagnostics(this.server.db.sequelize);
    }
    init() { this.createSocket('diagnosticsGet',this.getDiagnostics,{},false); }
}
module.exports=DiagnosticsSocket;
