# Content Server

## Description
This directory contains all files to serve the frontend website to the user.

## Architecture
For an overview of the complete architecture, see ./docs/architecture.drawio\
(You can use either the [PyCharm Plugin](https://plugins.jetbrains.com/plugin/15635-diagrams-net-integration) as well as the [Website](http://app.diagrams.net))\
__Note:__ If you change anything on the structure, also update the architecture file!

## Installation

Check if all git submodules files (in Folder frameworks) are downloaded, otherwise use ``git pull --recurse-submodules``  

    sudo npm install --global yarn      # if yarn is not installed yet
    sudo npm install --global gulp-cli  # needed for pdf.js
    make docker                         # build docker images from code and start 

For development use:

    make clean      # clean everything
    make dev        # developing environment - start content server on port 3001
    make h_server   # to start the Hypothesis Server on Port 5000

## Setting up hypothesis server

### Short way
1. Change Environment Variables in Makefile
2. `make init`

### Long way

1. Add admin account to hypothesis server:


    cd frameworks/hypothesis/h
    tox -qe dev -- sh bin/hypothesis --dev user add --username <username> --email <email> --password <password>
    tox -qe dev -- sh bin/hypothesis --dev user admin <username>

2. Sign in on the hypothesis server: http://localhost:5000/
3. Create oAuth client token: http://localhost:5000/admin/oauthclients/new
4. Create oAuth

  
    Name: < custom name > 
    Authority: localhost 
    Grand type: authorization_code
    Trusted: Yes
    Redirect URL: http://localhost:5000/app.html

5. Get Client ID and add it into the Makefile!

### Frameworks
- [Git Submodules](http://git-scm.com/book/en/v2/Git-Tools-Submodules) are used to include the following frameworks:
    - [PDFjs](https://mozilla.github.io/pdf.js) - to display the PDFs
    - [Hypothesis](https://web.hypothes.is/) - to annotating text in the PDFs
  
#### Build Frameworks individually

    make pdfjs     # build PDFjs Framework
    make h_client  # build Hypothesis Client
    make h_server  # build Hypothesis Server

__Note__: See also the architecture overview for further information how the frameworks interact!
