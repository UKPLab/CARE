'use strict';

/**
 * Data-driven UI config for the Triggers dashboard.
 */
module.exports = {
    columns: [
        { name: 'Name', key: 'name' },
        { name: 'Event', key: 'eventLabel' },
        { name: 'Action', key: 'actionLabel' },
        { name: 'Enabled', key: 'enabled', type: 'toggle' },
    ],
    rowResolvers: {
        eventLabel: {
            type: 'catalogLabel',
            table: 'trigger_event',
            foreignKey: 'triggerEventId',
        },
        actionLabel: {
            type: 'catalogLabel',
            table: 'trigger_action',
            foreignKey: 'triggerActionId',
        },
        enabled: {
            type: 'toggle',
            title: 'Enable / disable trigger',
            action: 'toggleEnabled',
            socketEvent: 'triggerUpdate',
            valueKey: 'enabled',
        },
    },
    manageActions: [
        {
            icon: 'eye',
            title: 'View trigger',
            action: 'view',
            handler: 'viewModal',
            options: { iconOnly: true, specifiers: { 'btn-outline-secondary': true } },
            modal: 'view',
        },
        {
            icon: 'pencil-square',
            title: 'Edit trigger',
            action: 'edit',
            handler: 'editStepper',
            options: { iconOnly: true, specifiers: { 'btn-outline-primary': true } },
        },
        {
            icon: 'trash',
            title: 'Delete trigger',
            action: 'delete',
            handler: 'confirmDelete',
            socketEvent: 'triggerDelete',
            options: { iconOnly: true, specifiers: { 'btn-outline-danger': true } },
            confirm: {
                title: 'Delete Trigger',
                message: 'Are you sure you want to delete "{name}"?',
            },
        },
    ],
    stepper: {
        steps: [
            { title: 'Trigger info' },
            { title: 'Event' },
            { title: 'Action' },
        ],
        submitText: 'Save',
        settingsFormSchema: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            {
                key: 'projectId',
                label: 'Scope to project',
                type: 'select',
                optionsSource: {
                    table: 'project',
                    labelKey: 'name',
                    valueKey: 'id',
                    emptyOption: { name: 'All projects', value: null },
                },
            },
            { key: 'maxRetries', label: 'Max retries', type: 'number', min: 0 },
            { key: 'parallelLimit', label: 'Parallel limit', type: 'number', min: 1 },
            { key: 'timeout', label: 'Timeout (seconds)', type: 'number', min: 1 },
        ],
        eventField: {
            key: 'triggerEventId',
            label: 'When (event)',
            type: 'select',
            required: true,
            optionsSource: { table: 'trigger_event', labelKey: 'configuration.label', nameKey: 'name', valueKey: 'id', filter: { enabled: true } },
        },
        actionField: {
            key: 'triggerActionId',
            label: 'Then (action)',
            type: 'select',
            required: true,
            optionsSource: { table: 'trigger_action', labelKey: 'configuration.label', nameKey: 'name', valueKey: 'id', filter: { enabled: true }, compatibleWithEvent: true },
        },
    },
    modals: {
        view: {
            title: 'Trigger: {name}',
            formSchema: [
                { key: 'name', label: 'Name', type: 'text', readOnly: true },
                { key: 'eventLabel', label: 'Event', type: 'text', readOnly: true },
                { key: 'actionLabel', label: 'Action', type: 'text', readOnly: true },
                { key: 'maxRetries', label: 'Max retries', type: 'text', readOnly: true },
                { key: 'parallelLimit', label: 'Parallel limit', type: 'text', readOnly: true },
                { key: 'timeout', label: 'Timeout (seconds)', type: 'text', readOnly: true },
                { key: 'configurationJson', label: 'Action configuration', type: 'textarea', readOnly: true },
            ],
        },
    },
    sockets: {
        create: 'triggerCreate',
        update: 'triggerUpdate',
        delete: 'triggerDelete',
    },
    tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
    },
    defaultForm: {
        name: '',
        description: '',
        projectId: null,
        maxRetries: 3,
        parallelLimit: 1,
        timeout: 300,
        triggerEventId: null,
        triggerActionId: null,
    },
};
