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
        <div class="d-flex align-items-center gap-3 mb-3">
          <span :class="assignByRole ? 'fw-bold' : 'text-muted'">Roles</span>
          <div class="form-check form-switch mb-0">
            <input
              id="assignModeSwitch"
              v-model="assignByUser"
              class="form-check-input"
              type="checkbox"
              role="switch"
              @change="onModeSwitchChange"
            />
            <label class="form-check-label" for="assignModeSwitch" />
          </div>
          <span :class="assignByUser ? 'fw-bold' : 'text-muted'">Users</span>
        </div>

        <div v-if="!assignByUser">
          <p class="text-muted mb-2">Select one or more roles allowed for this assignment.</p>
          <BasicTable
            v-model="selectedRoles"
            :columns="roleColumns"
            :data="availableRoles"
            :options="selectionTableOptions"
            :max-table-height="300"
          />
        </div>

        <div v-else>
          <p class="text-muted mb-2">Select one or more users allowed for this assignment.</p>
          <BasicTable
            v-model="selectedUsers"
            :columns="userColumns"
            :data="availableUsers"
            :options="selectionTableOptions"
            :max-table-height="300"
          />
        </div>
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

/**
 * Multi-step modal for creating and editing assignments.
 *
 * Step 1 lets the admin select which user roles are eligible for the assignment.
 * Step 2 presents the assignment configuration form (title, dates, revision
 * limit, validation configuration, re-upload policy, etc.).
 * Opens in create mode via open() or in edit mode via open(assignmentId).
 *
 * @author Karim Ouf
 */
export default {
	name: "AssignmentModal",
	components: { StepperModal, BasicForm, BasicTable },
	subscribeTable: ["assignment", "user_role", "user", "assignment_share", "study", "workflow", "configuration"],
	data() {
		return {
			assignmentId: 0,
			formData: {},
			selectedRoles: [],
			selectedUsers: [],
			steps: [
				{ title: "User Roles" },
				{ title: "Assignment" },
			],
			roleColumns: [
				{ name: "ID", key: "id", sortable: true },
				{ name: "Role", key: "name", sortable: true },
			],
			userColumns: [
				{ name: "ID", key: "id", sortable: true },
				{ name: "Username", key: "userName", sortable: true },
				{ name: "First Name", key: "firstName", sortable: true },
				{ name: "Last Name", key: "lastName", sortable: true },
			],
			selectionTableOptions: {
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
		projectId() {
		return this.$store.getters["settings/getValueAsInt"]("projects.default");
		},
		currentUserId() {
			return this.$store.getters["auth/getUserId"];
		},
		assignmentFields() {
			return this.$store.getters["table/assignment/getFields"] || [];
		},
		availableRoles() {
			return (this.$store.getters["table/user_role/getAll"] || []).filter((role) => !role.deleted);
		},
		availableUsers() {
			return (this.$store.getters["table/user/getAll"] || []).filter((user) => !user.deleted);
		},
		existingAssignmentRoles() {
 			return this.$store.getters["table/assignment_share/getFiltered"]((e) => e.assignmentId === this.assignmentId) || [];
		},
		stepValidation() {
			return [
				this.selectedRoles.length > 0 || this.selectedUsers.length > 0,
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
		onModeSwitchChange() {
			this.selectedRoles = [];
			this.selectedUsers = [];
		},
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
			this.assignByUser = false;
			this.formData = this.getDefaultFormData();
			this.selectedRoles = [];
			this.selectedUsers = [];

			if (assignmentId !== 0) {
				const assignment = this.$store.getters["table/assignment/get"](assignmentId);
				if (assignment) {
					this.formData = { ...this.formData, ...assignment };

					const entries = (this.$store.getters["table/assignment_share/getAll"] || [])
						.filter(e => e.assignmentId === assignmentId && !e.deleted);

						const roleIds = new Set(entries.filter(e => e.roleId).map(e => e.roleId));
					const userIds = new Set(entries.filter(e => e.userId).map(e => e.userId));

					if (roleIds.size > 0) {
						this.assignByUser = false;
						this.selectedRoles = this.availableRoles.filter(r => roleIds.has(r.id));
					} else if (userIds.size > 0) {
						this.assignByUser = true;
						this.selectedUsers = this.availableUsers.filter(u => userIds.has(u.id));
					}
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
			if (!isValidated) return;

			this.$refs.stepperModal.setWaiting(true);

			const payload = {
				...this.formData,
				userId: this.formData.userId || this.currentUserId,
				projectId: this.projectId,
			};

			// 1. Save the assignment itself
			this.$socket.emit("appDataUpdate", { table: "assignment", data: payload }, (assignmentResult) => {
				if (!assignmentResult.success) {
					this.$refs.stepperModal.setWaiting(false);
					this.eventBus.emit("toast", {
						title: "Could not save assignment",
						message: assignmentResult.message,
						variant: "danger",
					});
					return;
				}

				const savedAssignmentId = assignmentResult.data?.id || assignmentResult.data || payload.id || this.assignmentId;

				const existing = (this.$store.getters["table/assignment_share/getAll"] || [])
					.filter(e => e.assignmentId === savedAssignmentId && !e.deleted);

				// Diff existing entries against current selection
				const toDelete = this.assignByUser
					? existing.filter(e => !this.selectedUsers.some(u => Number(u.id) === e.userId))
					: existing.filter(e => !this.selectedRoles.some(r => Number(r.id) === e.roleId));

				const toCreate = this.assignByUser
					? this.selectedUsers
						.filter(u => !existing.some(e => e.userId === Number(u.id)))
						.map(u => ({ assignmentId: savedAssignmentId, userId: Number(u.id), roleId: null }))
					: this.selectedRoles
						.filter(r => !existing.some(e => e.roleId === Number(r.id)))
						.map(r => ({ assignmentId: savedAssignmentId, roleId: Number(r.id), userId: null }));

				for (const entry of toDelete) {
					this.$socket.emit("appDataUpdate", { table: "assignment_share", data: { id: entry.id, deleted: true } });
				}

				for (const entry of toCreate) {
					this.$socket.emit("appDataUpdate", { table: "assignment_share", data: entry });
				}

				this.$refs.stepperModal.setWaiting(false);
				this.assignmentId = savedAssignmentId;
				this.eventBus.emit("toast", {
					title: "Assignment saved",
					message: `Assignment has been successfully ${payload.id ? "updated" : "created"}.`,
					variant: "success",
				});
				this.$refs.stepperModal.close();
			});
		},
	},
};
</script>
