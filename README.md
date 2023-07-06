# CARE - Collaborative AI-Assisted Reading Environment

CARE is a collaborative reading environment that allows users to read and annotate documents together.

A demo of the latest public version is available under https://care.ukp.informatik.tu-darmstadt.de.

## Quickstart

Make sure you have [Git](https://git-scm.com/downloads), [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

```shell
git clone https://github.com/UKPLab/CARE.git && cd CARE
make ENV=main build 
```

The application is now available under http://localhost:9090.

__Note:__ On Windows, you need to install [GnuWin32 Make](http://gnuwin32.sourceforge.net/packages/make.htm) or just run `winget install GnuWin32.Make` and make it executable with `set PATH=%PATH%;C:/Program Files (x86)/GnuWin32/bin`.

### Documentation

You can find the latest version of the documentation under https://care.ukp.informatik.tu-darmstadt.de/docs/.

The documentation can also be built locally by running `make doc` and is then available under `docs/build/html/index.html`.

## Contact 

_Maintainers:_

* Dennis Zyska (dennis.zyska@tu-darmstadt.de) 
* Nils Dycke (nils.dycke@tu-darmstadt.de)

Don't hesitate to send us an e-mail or report an issue, if something is broken or if you have further questions.

https://www.ukp.tu-darmstadt.de \
https://www.tu-darmstadt.de

### Citation

If you use this software, please cite the following paper:

```bibtex
@misc{https://doi.org/10.48550/arxiv.2302.12611,
  doi = {10.48550/ARXIV.2302.12611},
  url = {https://arxiv.org/abs/2302.12611},
  author = {Zyska, Dennis and Dycke, Nils and Buchmann, Jan and Kuznetsov, Ilia and Gurevych, Iryna},
  keywords = {Computation and Language (cs.CL), FOS: Computer and information sciences, FOS: Computer and information sciences},
  title = {CARE: Collaborative AI-Assisted Reading Environment},
  publisher = {arXiv},
  year = {2023},
  copyright = {Creative Commons Attribution Non Commercial Share Alike 4.0 International}
}
```

### Disclaimer

This repository contains experimental software and is published for the sole purpose of giving additional background details on the respective publication.\
The software is only tested on unix systems and is not guaranteed to work on other operating systems.
