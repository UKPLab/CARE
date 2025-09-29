module.exports = [
    {
        key: "name",
        label: "Node Name:",
        placeholder: "Enter node name",
        type: "text",
        required: true,
        default: "",
        minlength: 2,
        maxlength: 100
    },
    {
        key: "description",
        label: "Description:",
        placeholder: "Enter node description",
        type: "textarea",
        required: false,
        default: ""
    },
    {
        key: "stepType",
        label: "Step Type:",
        type: "select",
        options: [
            { value: 1, name: "Annotator" },
            { value: 2, name: "Editor" },
            { value: 3, name: "Modal" }
        ],
        required: true,
        default: 2,
        help: "Choose the type of workflow step."
    },
    {
        key: "allowBackward",
        label: "Allow Backward Navigation:",
        type: "switch",
        default: false,
        help: "Allow users to navigate back to this step."
    },
    {
        key: "workflowStepDocument",
        label: "Document Step Reference:",
        type: "select",
        options: {
            table: "workflow_step",
            name: "name",
            value: "id",
            filter: [
                {type: "formData", key: "workflowId", value: "workflowId"}
            ]
        },
        required: false,
        help: "Reference to another workflow step for document handling."
    }
];