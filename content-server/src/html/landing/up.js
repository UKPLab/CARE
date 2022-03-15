const UploadApp = require("./components/UploadApp");

if (process.env.NODE_ENV !== 'production') {
    require('preact/debug');
}

const { render } = require("preact");
  

export class Uploading {
    constructor(element, configuration = {}){
        this.element = element;
        this.config = configuration;

        this.warn_fun = (app, msg) => console.warn(msg);
        this.done_fun = (app, msg) => console.log(msg);
    }

    _check_file(file){
        return file.name.endsWith(".pdf")
            && file.size/1000.0 < 3000;
    }

    _warn(error_msg){
        this.warn_fun(this.element, error_msg);
    }

    _finished(status, res){
        this.done_fun(this.element, status, res)
    }

    setWarningChannel(warn_fun){
        this.warn_fun = warn_fun;
    }

    setDoneChannel(done_fun){
        this.done_fun = done_fun;
    }

    upload(event){
        console.log("Uploading!");

        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
        event.stopPropagation();

        console.log(event);

        if (event.dataTransfer.items) {
            if(event.dataTransfer.items.length > 1){
                this._warn("Error: Cannot upload multiple files... Try again with one.");
                return;
            }
            
            var item = event.dataTransfer.items[0];
            if(item.kind != "file"){
                this._warn("Error: The dropped element is NOT a file... Try again with a file.");
                return;
            }
            var file = item.getAsFile();
          } else {
            if(event.dataTransfer.files.length > 1) {
                this._warn("Error: Cannot upload multiple files... Try again with one.");
                return;
            }
            var file = event.dataTransfer.files[0];
          }

        console.log('loading ' + file.name);  
        
        //check file
        if(!this._check_file(file)){
            this._warn("Error: The provided file is invalid. Is it a .pdf? Is it below 3MB?")
            return;
        }

        //upload file
        var formData = new FormData();
        formData.append("file", file);

        fetch(this.config.assetRoot + "pdf_upload", {
            method: "POST",
            body: formData
        })
        .then((res) => {
            console.log(res);
            res.json().then((data) => this._finished("SUCCESS", data));
        })
        .catch(() => this._finished("FAILURE"));
    }

    dragging(ev){
        console.log('File(s) in drop zone');

        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
    }
}  

/**
 * @param {Document} doc
 * @param {string} href
 */
function injectStylesheet(doc, href) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
  
    doc.head.appendChild(link);
}

/**
 * @param {Document} doc
 * @param {SidebarAppConfig|AnnotatorConfig} config
 * @param {string[]} assets
 */
 function injectAssets(doc, config, assets) {
    assets.forEach(function (path) {
      const url = config.assetRoot + 'build/' + path;
      if (url.match(/\.css/)) {
        injectStylesheet(doc, url);
      } else {
        injectScript(doc, url);
      }
    });
  }

export function uploading(document, config){
    injectAssets(document, config, [    
        'styles/upload.css',
      ]);

    const container = document.querySelector('uploadapp');
    const up = new Uploading(container, config)
    
    render("<UploadApp uploadLogic={up}/>", container);
}

