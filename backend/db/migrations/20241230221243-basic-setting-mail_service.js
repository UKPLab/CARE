'use strict';

const settings = [{
    key: "system.mailService.enabled",
    value: "true",
    type: "boolean",
    description: "Enable the mail service (changes require a restart of the server)"
}, {
    key: "system.mailService.senderAddress",
    value: "system@localhost",
    type: "string",
    description: "The sender address for mails"
}, {
    key: "system.mailService.sendMail.enabled",
    value: "false",
    type: "boolean",
    description: "Use the sendMail function of an unix system",
}, {
    key: "system.mailService.sendMail.path",
    value: "/usr/sbin/sendmail",
    type: "string",
    description: "The path to the sendmail binary (default: /usr/sbin/sendmail)"
}, {
    key: "system.mailService.smtp.enabled",
    value: "true",
    type: "boolean",
    description: "Use an SMTP server for sending mails (sendMail must be disabled!)"
}, {
    key: "system.mailService.smtp.host",
    value: "smtp.gmail.com",
    type: "string",
    description: "The hostname of the SMTP server"
}, {
    key: "system.mailService.smtp.port",
    value: "587",
    type: "integer",
    description: "The port of the SMTP server"
}, {
    key: "system.mailService.smtp.secure",
    value: "true",
    type: "boolean",
    description: "Use a secure connection to the SMTP server"
}, {
    key: "system.mailService.smtp.auth.enabled",
    value: "true",
    type: "boolean",
    description: "Use authentication for the SMTP server"
}, {
    key: "system.mailService.smtp.auth.user",
    value: "",
    type: "string",
    description: "The username for the SMTP server"
}, {
    key: "system.mailService.smtp.auth.pass",
    value: "",
    type: "string",
    description: "The password for the SMTP server"
}];

module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
            t['createdAt'] = new Date();
            t['updatedAt'] = new Date();
            return t;
        }), {returning: true});

    },

    async down(queryInterface, Sequelize) {
        //delete nav elements first
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        }, {});
    }
};
