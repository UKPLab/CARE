/* Service.js - Defines as new Service class

This class is used to create a service object

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

module.exports = class Service {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
    }
}