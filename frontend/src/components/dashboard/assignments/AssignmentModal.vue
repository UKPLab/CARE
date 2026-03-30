<template>
  <StepperModal
    ref="stepperModal"
    :steps="steps"
    :validation="stepValidation"
    submit-text="Save Assignment"
    @submit="submit"
  >
    <template #title>
      <h5 class="modal-title">{{ modalTitle }}</h5>
    </template>

	<template #step-1>
      <div class="p-3">
        <h6 class="mb-2">Assign To User Roles</h6>
        <p class="text-muted mb-3">Select one or more roles allowed for this assignment.</p>
        <BasicTable
          v-model="selectedRoles"
          :columns="roleColumns"
          :data="availableRoles"
          :options="roleTableOptions"
          :max-table-height="420"
        />
      </div>
    </template>

		<template #step-2>
			<div class="p-3">
				<BasicForm
					ref="assignmentForm"
					v-model="formData"
					:fields="assignmentFields"
				/>
			</div>
		</template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";

export default {
	name: "AssignmentModal",
	components: { StepperModal, BasicForm, BasicTable },
	subscribeTable: ["assignment", "user_role", "study", "workflow", "configuration"],
	data() {
		return {
			assignmentId: 0,
			formData: {},
			selectedRoles: [],
			steps: [
				{ title: "User Roles" },
				{ title: "Assignment" },
			],
			roleColumns: [
				{ name: "ID", key: "id", sortable: true },
				{ name: "Role", key: "name", sortable: true },
			],
			roleTableOptions: {
				striped: true,
				hover: true,
				bordered: false,
				borderless: false,
				small: false,
				selectableRows: true,
				scrollY: true,
				scrollX: true,
				search: true,
			},
		};
	},
	computed: {
		currentUserId() {
			return this.$store.getters["auth/getUserId"];
		},
		assignmentFields() {
			return this.$store.getters["table/assignment/getFields"] || [];
		},
		availableRoles() {
			return (this.$store.getters["table/user_role/getAll"] || []).filter((role) => !role.deleted);
		},
		stepValidation() {
			return [
				this.selectedRoles.length > 0,
				this.isAssignmentFormValid,
			];
		},
		isAssignmentFormValid() {
			return this.assignmentFields
				.filter((field) => field.required)
				.every((field) => {
					const value = this.formData[field.key];
					if (typeof value === "number") {
						return !Number.isNaN(value);
					}
					return value !== null && value !== undefined && value !== "";
				});
		},
		modalTitle() {
			return this.assignmentId !== 0 ? "Edit Assignment" : "New Assignment";
		},
	},
	methods: {
		getDefaultFormData() {
			const defaults = {};
			for (const field of this.assignmentFields) {
				if (Object.prototype.hasOwnProperty.call(field, "default")) {
					defaults[field.key] = field.default;
				}
			}
			return defaults;
		},
		open(assignmentId = 0, copy = false) {
			this.assignmentId = assignmentId;
			this.formData = this.getDefaultFormData();
			this.selectedRoles = [];

			if (assignmentId !== 0) {
				const assignment = this.$store.getters["table/assignment/get"](assignmentId);
				if (assignment) {
					this.formData = {
						...this.formData,
						...assignment,
					};

					const assignedRoleIds = Array.isArray(assignment.assignedRoleIds) ? assignment.assignedRoleIds : [];
					this.selectedRoles = this.availableRoles.filter((role) => assignedRoleIds.includes(role.id));
				}
			}

			if (copy) {
				delete this.formData.id;
				this.formData.userId = this.currentUserId;
				this.formData.closed = null;
			}

			this.$refs.stepperModal.open();
		},
		close() {
			this.$refs.stepperModal.close();
		},
		submit() {
			const isValidated = this.$refs.assignmentForm?.validate?.() ?? false;
			if (!isValidated) {
				return;
			}

			this.$refs.stepperModal.setWaiting(true);

			const payload = {
				...this.formData,
				userId: this.formData.userId || this.currentUserId,
				assignedRoleIds: this.selectedRoles.map((role) => Number(role.id)).filter((id) => Number.isInteger(id)),
			};

			this.$socket.emit(
				"appDataUpdate",
				{
					table: "assignment",
					data: payload,
				},
				(result) => {
					this.$refs.stepperModal.setWaiting(false);
					if (result.success) {
						this.assignmentId = result.data?.id || result.data || this.assignmentId;
						this.eventBus.emit("toast", {
							title: "Assignment saved",
							message: `Assignment has been successfully ${payload.id ? "updated" : "created"}.`,
							variant: "success",
						});
						this.$refs.stepperModal.close();
					} else {
						this.eventBus.emit("toast", {
							title: "Could not save assignment",
							message: result.message,
							variant: "danger",
						});
					}
				}
			);
		},
	},
};
</script>
