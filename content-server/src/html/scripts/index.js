const axios = require("axios");

// Upload function
document.getElementById("uploadButton").onclick = () => {
      let fileElement = document.getElementById('fileInput')

      // check if user had selected a file
      if (fileElement.files.length === 0) {
        alert('please choose a file')
        return
      }

      let formData = new FormData();
      formData.set('file', fileElement.files[0]);

      axios.post(
          "/api/upload",
          formData,
          {
                onUploadProgress: progressEvent => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                console.log(`upload process: ${percentCompleted}%`);
            }
      }).then(res => {
          console.log(res.data)
          console.log(res.data.id)
          window.location.href = `/annotate/${res.data.id}`;
      })
}
