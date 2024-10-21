<template>
  <BasicModal
    ref="peerReviewModal"
    xl
    name="documentUpload"
    class="custom-modal"
  >
    <template #title>
      <span>Create Peer Reviews</span>
      </template>
      <template #body>
        <div>
    <h3>Available Reviews:</h3>
    <table class="table">
          <thead>
            <tr>
              <th style="font-size: 18px;">Assignment</th>
              <th style="font-size: 18px;">Select</th>
              <th style="font-size: 18px;">Number of Moderators</th>
              <th style="font-size: 18px;">Number of Students</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in items" :key="index">
              <td>
                <span style="font-size: 18px;">{{ item }}</span>
              </td>
              <td>
                <input
                  type="checkbox"
                  :value="item"
                  v-model="selectedItems"
                  class="custom-checkbox"
                />
              </td>
              <td>
                <div class="sliders">
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    v-model="sliderValues[index].slider1" 
                    class="slider"
                  />
                  <span>{{ sliderValues[index].slider1 }}</span>
                </div>
              </td>
              <td>
                <div class="sliders">
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    v-model="sliderValues[index].slider2" 
                    class="slider"
                  />
                  <span>{{ sliderValues[index].slider2 }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

    <!-- Select All checkbox -->
    <div class="select-all">
      <label>
        <input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" />
        Select All
      </label>
    </div>

    <button
            class="btn btn-primary"
            type="button"
            @click="LoadAssignments()"
        >
          Load Assignments
        </button>
    <button
            class="btn btn-primary"
            type="button"
            @click="createPeerReviews()"
        >
          Assign
        </button>

    

    <!-- Display the selected item -->
    <div v-if="selectedItem">
      <p>Selected Item: {{ selectedItem }}</p>
    </div>
  </div>
    </template>
  </BasicModal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/table/Table.vue";
import BasicButton from "@/basic/Button.vue";
import BasicModal from "@/basic/Modal.vue";


/**
 * Document upload component
 *
 * This component provides the functionality for uploading a document
 * to the server. The user is prompted the option to select a PDF from
 * disk.
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  emits: ["createPeerReviews"],
  name: "DocumentUploadModal",
  components: {Modal,  BasicModal, BasicForm, BasicTable, BasicButton },
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  data() {
    return {
      usersReference: null,
      items: [],
      // This will store the selected item
      selectedItems: [],
      sliderValues: []
    }
  },
  computed: {
    isAllSelected() {
      return this.selectedItems.length === this.items.length;
    }
  },
  mounted() {
  },
  created() {
    
  },
  methods: {
    createPeerReviews() {
      const data =  []
      const sliders = this.sliderValues
      const selected = this.selectedItems
      let i = 1;
      this.items.forEach(function(item, index) {
        
        if(selected.includes(item))
      {
        let moderators = []
        for(let i = 0; i < sliders[index].slider1; i++)
      {
        moderators.push("Test moderator")
      }
      let students = []
      for(let i = 0; i < sliders[index].slider2; i++)
      {
        students.push("Test student")
      }
        data.push({id: i, docName: item, mods: moderators, students: students, finished: false, manage: [
        {
          title: "Edit Review",
          action: "editReviews",
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "View Rights",
          action: "viewRights",
          icon: "card-list",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "Reset Password",
          action: "resetPassword",
          icon: "person-lock",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
      ]
    })
      }
      i = i+1
      });
    
      this.$emit('createPeerReviews', data)
    },
    LoadAssignments() {
      this.items = ["Document 1", "Document 2", "Document 3", "Document 4"]
      this.initializeSliderValues();
    },
    initializeSliderValues() {
      if (this.items && this.items.length > 0) {
        this.sliderValues = this.items.map(() => ({
          slider1: 1, // Default value for slider 1
          slider2: 2, // Default value for slider 2
        }));
      }
    },
    toggleSelectAll(event) {
      if (event.target.checked) {
        this.selectedItems = [...this.items]; // Select all items
      } else {
        this.selectedItems = []; // Deselect all items
      }
    },
    open(usersReference) {
      this.$refs.peerReviewModal.openModal();
      this.usersReference = usersReference;
    },
    upload() {
      const fileElement = document.getElementById('fileInput');

      // check if user had selected a file
      if (fileElement.files.length === 0) {
        alert('please choose a file')
        return
      }

      const fileName = fileElement.files[0].name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      switch (fileType) {
        case ".delta":
          this.$socket.emit("uploadFile", {type: "deltaDocument", file: fileElement.files[0], name: fileName});
          break;

        default:
          this.$socket.emit("uploadFile", {type: "document", file: fileElement.files[0], name: fileName});
          break;
      }

      this.uploading = true;
    }
  },

}
</script>

<style scoped>

.item-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 18px;
}

.list-item {
  display: flex;
  justify-content: space-between; /* Pushes the radio button to the right */
  align-items: center;
  margin-bottom: 10px;
}

/* Customize the radio button appearance to look like a square */
.custom-radio {
  width: 20px;
  height: 20px;
  appearance: none;
  background-color: white;
  border: 2px solid #ccc;
  border-radius: 4px; /* Rounded corners for the square */
  outline: none;
  cursor: pointer;
  position: relative;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.custom-radio:checked {
  background-color: #42b983; /* Color when checked */
  border-color: #42b983;
}

.custom-checkbox {
  width: 20px;
  height: 20px;
  appearance: none;
  background-color: white;
  border: 2px solid #ccc;
  border-radius: 4px; /* Rounded corners for the square */
  outline: none;
  cursor: pointer;
  position: relative;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  margin-right: 10px;
  margin-left: 10px;
}

.custom-checkbox:checked {
  background-color: #ffffff; /* Color when checked */     /* Matching border color when checked */
}

.custom-checkbox:checked::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 7px;
  width: 6px;
  height: 10px;
  border: solid rgb(47, 131, 214);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg); /* Creates the checkmark */
}

.sliders {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider {
  width: 100px; /* Adjust slider width */
}

.select-all
{
  font-size: 18px;
}

</style>
