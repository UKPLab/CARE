<template>
	<BasicCoordinator
		ref="coordinator"
		table="assignment"
		title="Assignment"
		@success="success"
	>
		<template #title>
			{{ modalTitle }}
		</template>
		<template v-if="isSuccess" #success>
			<div>
				Assignment has been successfully {{ assignmentId !== 0 ? "updated" : "created" }}.
			</div>
		</template>
	</BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

export default {
	name: "AssignmentModal",
	components: { BasicCoordinator },
	data() {
		return {
			assignmentId: 0,
		};
	},
	computed: {
		modalTitle() {
			return this.assignmentId !== 0 ? "Edit Assignment" : "New Assignment";
		},
	},
	methods: {
		open(assignmentId = 0, copy = false) {
			this.assignmentId = assignmentId;
			this.$refs.coordinator.open(assignmentId, {}, copy);
		},
		close() {
			this.$refs.coordinator.close();
		},
		success(id) {
			this.assignmentId = id;
		},
	},
};
</script>
