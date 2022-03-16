# Content Server

## Description
This directory contains all files to serve the frontend website to the user.

## Architecture
For an overview of the complete architecture, see ./docs/architecture.drawio\
(You can use either the [PyCharm Plugin](https://plugins.jetbrains.com/plugin/15635-diagrams-net-integration) as well as the [Website](http://app.diagrams.net))\
__Note:__ If you change anything on the structure, also update the architecture file!

## Installation
Check if all git submodules files (in Folder frameworks) are downloaded, otherwise use ``git pull --recurse-submodules``  

For development use:

    npm install --global yarn # if yarn is not installed yet
    make dev

The webserver should start on http://localhost:3000.

## Main Frameworks
- [Hypothesis](https://web.hypothes.is/) is used for annotating text passages in the PDFs.
- [Git Submodules](http://git-scm.com/book/en/v2/Git-Tools-Submodules) are used for including additional frameworks

__Note__: See also the architecture overview for further information about the frameworks!
