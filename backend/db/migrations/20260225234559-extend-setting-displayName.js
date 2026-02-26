'use strict';

/**
 * Add displayName and displayGroup columns.
 * displayName: user-facing label from CSV Suggested Name
 * displayGroup: section grouping for non-wizard settings from CSV Suggested group naming
 *
 * @type {import('sequelize-cli').Migration}
 */

const KEY_TO_DISPLAY_GROUP = {
    'annotator.collab.response': 'Annotations',
    'annotator.comments.defaultNumsShown.levelOneUp': 'Annotations',
    'annotator.comments.defaultNumsShown.levelZero': 'Annotations',
    'annotator.comments.votes.enabled': 'Annotations',
    'annotator.comments.votes.onlyUpvote': 'Annotations',
    'annotator.download.enabledBeforeStudyClosing': 'Annotations',
    'annotator.nlp.activated': 'Annotations',
    'annotator.nlp.request.timeout': 'Annotations',
    'annotator.nlp.sentiment_analysis.activated': 'Annotations',
    'annotator.nlp.summarization.activated': 'Annotations',
    'annotator.nlp.summarization.annoLength': 'Annotations',
    'annotator.nlp.summarization.maxLength': 'Annotations',
    'annotator.nlp.summarization.minLength': 'Annotations',
    'annotator.nlp.summarization.skillName': 'Annotations',
    'annotator.sidebar.maxWidth': 'Annotations',
    'annotator.sidebar.minWidth': 'Annotations',
    'app.login.passwordResetRateLimit': 'General',
    'app.register.emailVerificationRateLimit': 'Registration',
    'dashboard.navigation.component.default': 'Interface',
    'editor.document.showButtonCreate': 'Text Editor',
    'editor.document.showButtonDeltaDownload': 'Text Editor',
    'editor.document.showButtonHTMLDownload': 'Text Editor',
    'editor.document.showButtonPDFDownload': 'Text Editor',
    'editor.edits.debounceTime': 'Text Editor',
    'editor.edits.historyGroupTime': 'Text Editor',
    'editor.edits.showHistoryForUser': 'Text Editor',
    'editor.toolbar.showHTMLDownload': 'Text Editor',
    'editor.toolbar.tools.align': 'Text Editor',
    'editor.toolbar.tools.background': 'Text Editor',
    'editor.toolbar.tools.blockquote': 'Text Editor',
    'editor.toolbar.tools.bold': 'Text Editor',
    'editor.toolbar.tools.checkList': 'Text Editor',
    'editor.toolbar.tools.clean': 'Text Editor',
    'editor.toolbar.tools.code-block': 'Text Editor',
    'editor.toolbar.tools.color': 'Text Editor',
    'editor.toolbar.tools.direction': 'Text Editor',
    'editor.toolbar.tools.font': 'Text Editor',
    'editor.toolbar.tools.formula': 'Text Editor',
    'editor.toolbar.tools.header': 'Text Editor',
    'editor.toolbar.tools.image': 'Text Editor',
    'editor.toolbar.tools.indent': 'Text Editor',
    'editor.toolbar.tools.italic': 'Text Editor',
    'editor.toolbar.tools.link': 'Text Editor',
    'editor.toolbar.tools.orderedList': 'Text Editor',
    'editor.toolbar.tools.size': 'Text Editor',
    'editor.toolbar.tools.strike': 'Text Editor',
    'editor.toolbar.tools.subscript': 'Text Editor',
    'editor.toolbar.tools.superscript': 'Text Editor',
    'editor.toolbar.tools.underline': 'Text Editor',
    'editor.toolbar.tools.unorderedList': 'Text Editor',
    'editor.toolbar.tools.video': 'Text Editor',
    'editor.toolbar.visibility': 'Text Editor',
    'modal.nlp.request.timeout': 'AI & NLP',
    'modal.nlp.rotation_timer.long': 'AI & NLP',
    'modal.nlp.rotation_timer.short': 'AI & NLP',
    'projects.default': 'Interface',
    'rpc.moodleAPI.showInput.apiKey': 'Moodle',
    'rpc.moodleAPI.showInput.apiUrl': 'Moodle',
    'rpc.moodleAPI.showInput.courseID': 'Moodle',
    'service.nlp.enabled': 'AI & NLP',
    'service.nlp.retryDelay': 'AI & NLP',
    'service.nlp.test.fallback': 'AI & NLP',
    'service.nlp.timeout': 'AI & NLP',
    'service.nlp.url': 'AI & NLP',
    'statistics.batch.size': 'Interface',
    'statistics.tracking.mouseDebounceTime': 'Interface',
    'system.auth.tokenExpiry.emailVerification': 'System',
    'system.auth.tokenExpiry.passwordReset': 'System',
    'tags.recencySortingIsOn': 'Interface',
    'tags.tagSet.default': 'Interface',
    'topBar.projects.hideProjectButton': 'Interface',
};

const DISPLAY_NAMES = {
    'annotator.collab.response': 'Comment replies',
    'annotator.comments.defaultNumsShown.levelOneUp': 'Level 1+ comments shown by default',
    'annotator.comments.defaultNumsShown.levelZero': 'Level 0 comments shown by default',
    'annotator.comments.votes.enabled': 'Voting on comments',
    'annotator.comments.votes.onlyUpvote': 'Only upvote on comments',
    'annotator.download.enabledBeforeStudyClosing': 'Download before study closing',
    'annotator.nlp.activated': 'NLP in annotation view',
    'annotator.nlp.request.timeout': 'NLP request timeout',
    'annotator.nlp.sentiment_analysis.activated': 'Sentiment analysis in comments',
    'annotator.nlp.summarization.activated': 'Summarization activated',
    'annotator.nlp.summarization.annoLength': 'Summarization annotation length',
    'annotator.nlp.summarization.maxLength': 'Summarization max length',
    'annotator.nlp.summarization.minLength': 'Summarization min length',
    'annotator.nlp.summarization.skillName': 'Summarization skill name',
    'annotator.sidebar.maxWidth': 'Sidebar max width',
    'annotator.sidebar.minWidth': 'Sidebar min width',
    'app.config.consent.enabled': 'Consent update feature',
    'app.config.copyright': 'Copyright notice',
    'app.landing.linkDocs': 'Documentation URL',
    'app.landing.linkFeedback': 'Feedback form URL',
    'app.landing.linkProject': 'Project page URL',
    'app.landing.showDocs': 'Show documentation link',
    'app.landing.showFeedback': 'Show feedback link',
    'app.landing.showProject': 'Show project link',
    'app.login.forgotPassword': 'Forgot password',
    'app.login.guest': 'Allow guest login',
    'app.login.passwordResetRateLimit': 'Password reset rate limit',
    'app.register.acceptDataSharing.default': 'Default accept data sharing',
    'app.register.acceptStats.default': 'Default accept tracking',
    'app.register.emailVerification': 'Email verification required',
    'app.register.enabled': 'Enable self-registration',
    'app.register.emailVerificationRateLimit': 'Email verification rate limit',
    'app.register.requestData': 'Request data sharing at registration',
    'app.register.requestName': 'Request name at registration',
    'app.register.requestStats': 'Request usage-stats consent at registration',
    'app.register.terms': 'Terms and conditions',
    'app.study.enabled': 'Enable study mode',
    'dashboard.navigation.component.default': 'Default dashboard component',
    'editor.document.showButtonCreate': 'Show create document button',
    'editor.document.showButtonDeltaDownload': 'Show delta download button',
    'editor.document.showButtonHTMLDownload': 'Show HTML download button',
    'editor.document.showButtonPDFDownload': 'Show PDF download button',
    'editor.edits.debounceTime': 'Edit debounce time',
    'editor.edits.historyGroupTime': 'Edit history group time',
    'editor.edits.showHistoryForUser': 'Show edit history to users',
    'editor.toolbar.showHTMLDownload': 'Toolbar HTML download',
    'editor.toolbar.tools.align': 'Toolbar align',
    'editor.toolbar.tools.background': 'Toolbar background',
    'editor.toolbar.tools.blockquote': 'Toolbar blockquote',
    'editor.toolbar.tools.bold': 'Toolbar bold',
    'editor.toolbar.tools.checkList': 'Toolbar check list',
    'editor.toolbar.tools.clean': 'Toolbar clean',
    'editor.toolbar.tools.code-block': 'Toolbar code-block',
    'editor.toolbar.tools.color': 'Toolbar color',
    'editor.toolbar.tools.direction': 'Toolbar direction',
    'editor.toolbar.tools.font': 'Toolbar font',
    'editor.toolbar.tools.formula': 'Toolbar formula',
    'editor.toolbar.tools.header': 'Toolbar header',
    'editor.toolbar.tools.image': 'Toolbar image',
    'editor.toolbar.tools.indent': 'Toolbar indent',
    'editor.toolbar.tools.italic': 'Toolbar italic',
    'editor.toolbar.tools.link': 'Toolbar link',
    'editor.toolbar.tools.orderedList': 'Toolbar ordered list',
    'editor.toolbar.tools.size': 'Toolbar size',
    'editor.toolbar.tools.strike': 'Toolbar strike',
    'editor.toolbar.tools.subscript': 'Toolbar subscript',
    'editor.toolbar.tools.superscript': 'Toolbar superscript',
    'editor.toolbar.tools.underline': 'Toolbar underline',
    'editor.toolbar.tools.unorderedList': 'Toolbar unordered list',
    'editor.toolbar.tools.video': 'Toolbar video',
    'editor.toolbar.visibility': 'Toolbar visibility',
    'modal.nlp.request.timeout': 'Modal NLP request timeout',
    'modal.nlp.rotation_timer.long': 'Modal NLP rotation long',
    'modal.nlp.rotation_timer.short': 'Modal NLP rotation short',
    'projects.default': 'Default project',
    'rpc.moodleAPI.apiKey': 'Moodle API key',
    'rpc.moodleAPI.apiUrl': 'Moodle API URL',
    'rpc.moodleAPI.courseID': 'Moodle course ID',
    'rpc.moodleAPI.showInput.apiKey': 'Show Moodle API key input',
    'rpc.moodleAPI.showInput.apiUrl': 'Show Moodle API URL input',
    'rpc.moodleAPI.showInput.courseID': 'Show Moodle course ID input',
    'service.nlp.enabled': 'Enable NLP features',
    'service.nlp.retryDelay': 'NLP retry delay',
    'service.nlp.test.fallback': 'NLP test fallback',
    'service.nlp.timeout': 'NLP timeout',
    'service.nlp.url': 'NLP service URL',
    'statistics.batch.size': 'Statistics batch size',
    'statistics.tracking.mouseDebounceTime': 'Mouse debounce time',
    'system.auth.tokenExpiry.emailVerification': 'Email verification token expiry',
    'system.auth.tokenExpiry.passwordReset': 'Password reset token expiry',
    'system.baseUrl': 'Base URL for emails',
    'system.mailService.enabled': 'Mail service enabled',
    'system.mailService.sendMail.enabled': 'Sendmail enabled',
    'system.mailService.sendMail.path': 'Sendmail path',
    'system.mailService.senderAddress': 'Mail sender address',
    'system.mailService.smtp.auth.enabled': 'SMTP auth enabled',
    'system.mailService.smtp.auth.pass': 'SMTP auth password',
    'system.mailService.smtp.auth.user': 'SMTP auth user',
    'system.mailService.smtp.enabled': 'SMTP enabled',
    'system.mailService.smtp.host': 'SMTP host',
    'system.mailService.smtp.port': 'SMTP port',
    'system.mailService.smtp.secure': 'SMTP secure',
    'tags.recencySortingIsOn': 'Tag recency sorting',
    'tags.tagSet.default': 'Default tag set',
    'topBar.projects.hideProjectButton': 'Hide project button in topbar',
};

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('setting', 'displayName', {
            type: Sequelize.STRING(256),
            allowNull: true,
        });
        await queryInterface.addColumn('setting', 'displayGroup', {
            type: Sequelize.STRING(128),
            allowNull: true,
        });

        const [results] = await queryInterface.sequelize.query(
            "SELECT key FROM setting WHERE deleted = false"
        );

        for (const row of results) {
            const key = row.key;
            const displayName = DISPLAY_NAMES[key];
            const displayGroup = KEY_TO_DISPLAY_GROUP[key];
            if (displayName) {
                await queryInterface.sequelize.query(
                    'UPDATE setting SET "displayName" = :displayName WHERE key = :key',
                    { replacements: { displayName, key } }
                );
            }
            if (displayGroup) {
                await queryInterface.sequelize.query(
                    'UPDATE setting SET "displayGroup" = :displayGroup WHERE key = :key',
                    { replacements: { displayGroup, key } }
                );
            }
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('setting', 'displayName');
        await queryInterface.removeColumn('setting', 'displayGroup');
    },
};