function FileUpload({ title, children }) {
    return (
      <section>
        <h1 className="heading">{title}</h1>
        {children}
      </section>
    );
  }
  
function FileDragAndDrop(name, upLogic) {
    const dropHandler = (event) => upLogic.upload(event);
    const dragHandler = (event) => upLogic.dragging(event)

    upLogic.setWarningChannel((app, warn) => {
      var msgField = app.querySelector("#upload_error");
      
      msgField.textContent = warn;
      msgField.style.display = "inline";
    });

    upLogic.setDoneChannel((app, status, res) => {
      var msgField = app.querySelector("#status");
      var resField = app.querySelector("#result");

      var resCtrl = app.querySelector("#result_link");
      var inField = app.querySelector("#result_link > input");
      var cpField = app.querySelector("#result_link > button");

      switch(status){
        case "SUCCESS": 
          msgField.textContent = "Successfully uploaded the file!";
          
          resField.textContent = "View pdf...";
          resField.onclick = () => {
            resField.style.backgroundColor = "grey";
            window.open(res.location);
          }
          resField.style.display = "inline-block";

          inField.value = res.location;
          cpField.onclick = () => {
            cpField.style.backgroundColor = "grey";
            
            inField.select();
            inField.setSelectionRange(0, 99999);
            document.execCommand("copy");
          };
          
          resCtrl.style.display = "inline";
          cpField.style.display = "inline-block";
          inField.style.display = "inline-block";
          break;
        case "FAILURE":
          msgField.textContent = "Failed to upload the file. Contact developers...";
          break;
        default:
          msgField.textContent = "Unknown problem during upload";
      }      
    });

    return (
      <FileUpload title={name}>
        <div id="drop_zone" ondrop={dropHandler} ondragover={dragHandler}>
          <img src="build/images/share.svg" alt="Upload a file..."></img>
          <p id="status">Drag and drop a .pdf file here...</p>
          <p id="upload_error"></p>
          <button id="result"></button>
          <p></p>
          <div id="result_link">
            <input type="text">...</input>
            <button>
              <img src="build/images/note.svg" alt="Copy"></img>
            </button>
          </div>
        </div>
      </FileUpload>
    );
  }
  
export default function UploadApp(uploadLogic) {
    var unpacked = uploadLogic.uploadLogic;  
    const content = FileDragAndDrop("Upload a paper...", unpacked);
  
    return (
      <main className="UploadApp">
        {content}
      </main>
    );
}