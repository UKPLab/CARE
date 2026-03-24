<template>
  <Card title="Socket Profiler">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn-primary btn-sm"
            text="Start Recording"
            title="Start Recording"
            icon="record-circle"
            @click="startRecording"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="tableColumns"
          :data="recordings"
          :options="tableOptions"
          :buttons="tableButtons"
          @action="action"
          :max-table-height="'65vh'"
      />
    </template>
  </Card>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";


export default {
  
  components: {
    Card,
    BasicTable,
    BasicButton,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      tableColumns: [
        {name: "ID", key: "id"},
        {name: "Name", key: "name"},
        {name: "Created At", key: "createdAt"},
        {name: "Duration", key: "duration"},
        {name: "Status", key: "status"},
      ],
      tableButtons: [
        {
          icon: "play-circle",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-success": true,
            },
          },
          title: "Replay recording",
          action: "replayRecording",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Delete recording",
          action: "deleteRecording",
        },
      ],
    };
  },
  computed: {
    recordings() {
      // Placeholder — will be replaced once DB table exists
      return [];
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "replayRecording":
          this.replayRecording(data.params);
          break;
        case "deleteRecording":
          this.deleteRecording(data.params);
          break;
      }
    },
    startRecording() {
      // TODO: implement recording logic
      this.eventBus.emit("toast", {
        title: "Recording",
        message: "Recording started",
        variant: "success",
      });
    },
    replayRecording(row) {
      // TODO: implement replay logic
      this.eventBus.emit("toast", {
        title: "Replay",
        message: "Replay started",
        variant: "success",
      });
    },
    deleteRecording(row) {
      // TODO: implement delete logic
      this.eventBus.emit("toast", {
        title: "Delete",
        message: "Recording deleted",
        variant: "success",
      });
    },
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>