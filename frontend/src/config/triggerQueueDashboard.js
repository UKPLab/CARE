/**
 * Data-driven UI config for the Trigger Logs dashboard.
 */
const statuses = [
  { name: "PENDING", value: 0, label: "Pending", badgeClass: "bg-secondary", flags: ["canCancel"] },
  { name: "RUNNING", value: 1, label: "Running", badgeClass: "bg-primary", flags: ["canCancel"] },
  { name: "COMPLETED", value: 2, label: "Completed", badgeClass: "bg-success", flags: [] },
  { name: "CANCELLED", value: 3, label: "Cancelled", badgeClass: "bg-warning text-dark", flags: [] },
  { name: "FAILED", value: 4, label: "Failed", badgeClass: "bg-danger", flags: ["canRetry", "hasError"] },
];

export default {
  statuses,
  columns: [
    { name: "Trigger", key: "triggerName" },
    { name: "Status", key: "status", type: "badge", badgeFrom: "statuses" },
    { name: "Attempts", key: "attemptCount" },
    { name: "Started", key: "startedAt", type: "datetime" },
  ],
  rowResolvers: {
    triggerName: {
      type: "fkLabel",
      table: "trigger",
      foreignKey: "triggerId",
      labelKey: "name",
      fallback: "#{triggerId}",
    },
    canRetry: { type: "flag", flags: ["canRetry"] },
    hasError: { type: "flag", flags: ["hasError"], orErrorMessage: true },
    canCancel: { type: "flag", flags: ["canCancel"] },
  },
  manageActions: [
    {
      icon: "x-circle",
      title: "Cancel",
      action: "cancel",
      handler: "confirmCancel",
      socketEvent: "triggerQueueCancel",
      options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
      filter: [{ key: "canCancel", value: true }],
      confirm: {
        title: "Cancel execution",
        message: 'Cancel this trigger run for "{triggerName}"?',
      },
      successToast: { title: "Cancelled", message: "The trigger execution has been cancelled." },
      errorToast: { title: "Cancel failed" },
    },
    {
      icon: "arrow-repeat",
      title: "Retry",
      action: "retry",
      handler: "socketCallback",
      socketEvent: "triggerQueueRetry",
      options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
      filter: [{ key: "canRetry", value: true }],
      successToast: { title: "Retry queued", message: "The failed execution has been set back to pending." },
      errorToast: { title: "Retry failed" },
    },
    {
      icon: "exclamation-triangle",
      title: "View error message",
      action: "viewError",
      handler: "errorModal",
      socketEvent: "triggerQueueGetDetails",
      options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
      filter: [{ key: "hasError", value: true }],
      modal: "error",
    },
  ],
  modals: {
    error: {
      title: "Error message",
      formSchema: [
        { key: "summary", label: "Trigger", type: "text", readOnly: true },
        { key: "errorMessage", label: "Error", type: "textarea", readOnly: true },
      ],
    },
  },
  tableOptions: {
    striped: true,
    hover: true,
    pagination: 10,
  },
};
