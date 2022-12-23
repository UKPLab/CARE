# PEER

The central launch point is the [Wiki](https://git.ukp.informatik.tu-darmstadt.de/zyska/peer/-/wikis) of the GitLab Project.

Run `make doc` to build the documentation or visit https://peer.ukp.informatik.tu-darmstadt.de/doc/ for the latest public version.

## Architecture

This section gives an overview on the components and architecture of the complete PEER tool.
For further details, please consider the respective README files in the subdirectories.

__Remark__: You can use either the [PyCharm Plugin](https://plugins.jetbrains.com/plugin/15635-diagrams-net-integration) as well as the [Website](http://app.diagrams.net) \
(For Pycharm Dark Mode User set it to Light (Kennedy) under Settings -> Languages & Frameworks -> diagrams.net) to view the diagrams.

__Note:__ If you change anything on the structure, also update the architecture files!

![architecture_content_server](docs/architecture.png)

## Code Structure

The code is structured in two main components: the backend and frontend. The code is grouped accordingly.

```
> backend         # backend of content server (express-based)
> frontend        # frontend of content server (vue-based)
> docs            # all documentation files (e.g. diagrams) go here
```



