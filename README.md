# PEER

PEER is a tool to support the peer review process of scientific papers.

For project maintainers: the central launch point is the [Wiki](https://git.ukp.informatik.tu-darmstadt.de/zyska/peer/-/wikis) of the GitLab Project.
For everyone: checkout this README for details on the code and an easy installation guide.

## Quick Start Guide
Before starting, check the system requirements and supported OS below.

1. Fetch and install all prerequisites:
```
sudo apt-get install git -y
git clone --recursive https://git.ukp.informatik.tu-darmstadt.de/zyska/peer.git
cd peer
sudo ./install.sh           # Install needed software packages
source pyenv.sh
```

2. Change the environment variables in the `.env` file.

3. Start the h server in one terminal:
```
make h_server
```

4. Initialize the database:
```
make init
```
5. Start our app in another terminal in development mode:
```
make dev
```
6. Visit localhost:3001 in your browser. You should see a login page. Login via guest and access the default document 
   to start annotating.

## Installation Manual
There are two possible situation for an installation, which are explained below:
1. The **production** environment in order to generate data or use the software with the current state of development.
2. The **development** environment to further develop the software and test changes directly.

### Minimum Requirements
Both environments are tested with a clean Ubuntu 20.04 LTS Installation (minimal installation).

For development run you will need a disk space at least of ~16 GB in total.\
Also the docker container of elastic search needs at least 2GB of RAM!

### Environment Setup
For all installations, we need the current data from the git repository and have to install some dependencies
    
    sudo apt-get install git -y
    git clone --recursive https://git.ukp.informatik.tu-darmstadt.de/zyska/peer.git
    cd peer/content-server
    sudo ./install.sh           # Install needed software packages

Please restart the terminal after running the install script or use `source pyenv.sh`.\
If something goes wrong, clean environment with ```make clean```.\
Note: If the submodules were not downloaded, use `git submodule update --init --recursive`\

### Development Build

This will run the main development code locally (Note: The first run will take some time...).
Change to the root directory of this repo. We assume you didn't change any environment variables.

#### Basic Development Build
1. Start the h server in one terminal. This should start three docker containers (RabbitMQ, Postgres, Elasticsearch)
   and the h server natively. After running this you should see the hypothesis front-end on
   [localhost:5000](http://localhost:5000).
```
make h_server
```
2. Initialize the database. This should run through without an error; if there is an error, it
   might be that the postgres docker container wasn't started properly.
```
make init
```
3. Start our app in another terminal in development mode. Afterwards you can check on the
   PEER tool at [localhost:3001](http://localhost:3001) and see the landing/login page.
```
make dev # Build everything and start content-server
```

#### ALTERNATIVE: Individual Development Builds
* Instead of step 3. above, you may not want to start the NLP server along with the content server
  if you are developing for only one of them. In that case, use one of the following commands to
  start them individually:
```
make frontend_dev   # build only the front-end / content server in dev mode
make nlp_dev        # build only the nlp server in dev mode
```

### Production Build

The software will be installed in a Docker environment and in production mode. 

    make build

The Content-Server should be available on port 80.\
Please make sure that the other ports are **not accessible** from outside, this applies above all for  the PostgreSQL Database!

__Hint:__  Use [Portainer CE](https://hub.docker.com/r/portainer/portainer-ce) for managing the docker containers with a GUI.\
For installation see [Install Instructions](https://docs.portainer.io/v/ce-2.9/start/install/server/docker/linux)




## Architecture

This section gives an overview on the components and architecture of the complete PEER tool.
For further details, please consider the respective README files in the subdirectories.

__Remark__: You can use either the [PyCharm Plugin](https://plugins.jetbrains.com/plugin/15635-diagrams-net-integration) as well as the [Website](http://app.diagrams.net) \
(For Pycharm Dark Mode User set it to Light (Kennedy) under Settings -> Languages & Frameworks -> diagrams.net) to view the diagrams.

__Note:__ If you change anything on the structure, also update the architecture files!

### Architecture of the Content Server

For an overview of the complete architecture, see ./docs/architecture.drawio\


![architecture_content_server](docs/architecture.png)

### Architecture of the NLP Server

![architecture_nlp_server](nlp/docs/tech.png)


## Code Structure

The code is structured in two main components: the content server and the NLP
server. The content server has a frontend and a backend part, while the NLP 
server resides only on the backend. The code is grouped accordingly.

```
> backend
> frontend
> frameworks      
> docs            # all documentation files (e.g. diagrams) go here
> resources       # resource files used during building/configuring
```


## Frameworks

See also the architecture overview for further information how the frameworks interact!

### Frontend

- [Vue 3](https://vuejs.org/) - Progressive JavaScript Framework
  - [Vuex](https://vuex.vuejs.org/) - State Management
  - [Vue Router](https://router.vuejs.org/) - Official Router for Vue.js
  - [Vue 3 - socket.io](https://www.npmjs.com/package/vue-3-socket.io) - Socket.io Client for Vue3
  - [Vue 3 - bootstrap](https://www.npmjs.com/package/bootstrap-vue-3) - Bootstrap for Vue 3
  
### Backend
__Content Server__:
- [Git Submodules](http://git-scm.com/book/en/v2/Git-Tools-Submodules) are used to include the following frameworks:
    - [PDFjs](https://mozilla.github.io/pdf.js) - to display the PDFs
    - [Hypothesis](https://web.hypothes.is/) - to annotating text in the PDFs

__NLP Server__:
- [Grobid](https://github.com/kermitt2/grobid) for document parsing in the NLP server
- [Flask](https://flask.palletsprojects.com/en/2.1.x/) as a basic http server 
- [socketio](https://flask-socketio.readthedocs.io/en/latest/) for websocket communication
- [Celery](https://docs.celeryq.dev/en/stable/getting-started/introduction.html) for running
  compute tasks



