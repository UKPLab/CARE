# CARE - Collaborative AI-Assisted Research Environment

CARE is a Collaborative AI-Assisted Research Environment that integrates reading, annotating, writing, and assessment workflows into a single platform for academic research teams.

A demo of the latest public version is available under https://demo.care.ukp.informatik.tu-darmstadt.de.

## Quickstart

Make sure you have [Git](https://git-scm.com/downloads), [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

```shell
git clone https://github.com/UKPLab/CARE.git && cd CARE
make ENV=main build 
```

The application is now available under http://localhost:9090.

__Note:__ On Windows, you need to install [GnuWin32 Make](http://gnuwin32.sourceforge.net/packages/make.htm) or just run `winget install GnuWin32.Make` and make it executable with `set PATH=%PATH%;C:/Program Files (x86)/GnuWin32/bin`.

### Documentation

You can find the documentation on GitHub Pages:
- Main branch: https://ukplab.github.io/CARE/main/
- Dev branch: https://ukplab.github.io/CARE/dev/

The documentation can also be built locally by running `make doc` and is then available under `docs/build/html/index.html`.

## Contact 

Don't hesitate to report an issue on GitHub or reach us directly via [Discord](https://discord.gg/4uX9aCZ6G7) if something is broken or if you have further questions.

https://care.ukp.informatik.tu-darmstadt.de \
https://www.ukp.tu-darmstadt.de \
https://www.tu-darmstadt.de

### Citation

If you use this software, please cite the following paper:

```bibtex
@inproceedings{zyska-etal-2023-care,
    title = "{CARE}: Collaborative {AI}-Assisted Reading Environment",
    author = "Zyska, Dennis  and
      Dycke, Nils  and
      Buchmann, Jan  and
      Kuznetsov, Ilia  and
      Gurevych, Iryna",
    booktitle = "Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 3: System Demonstrations)",
    month = jul,
    year = "2023",
    address = "Toronto, Canada",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2023.acl-demo.28",
    doi = "10.18653/v1/2023.acl-demo.28",
    pages = "291--303",
    abstract = "Recent years have seen impressive progress in AI-assisted writing, yet the developments in AI-assisted reading are lacking. We propose inline commentary as a natural vehicle for AI-based reading assistance, and present CARE: the first open integrated platform for the study of inline commentary and reading. CARE facilitates data collection for inline commentaries in a commonplace collaborative reading environment, and provides a framework for enhancing reading with NLP-based assistance, such as text classification, generation or question answering. The extensible behavioral logging allows unique insights into the reading and commenting behavior, and flexible configuration makes the platform easy to deploy in new scenarios. To evaluate CARE in action, we apply the platform in a user study dedicated to scholarly peer review. CARE facilitates the data collection and study of inline commentary in NLP, extrinsic evaluation of NLP assistance, and application prototyping. We invite the community to explore and build upon the open source implementation of CARE.Github Repository: \url{https://github.com/UKPLab/CAREPublic} Live Demo: \url{https://care.ukp.informatik.tu-darmstadt.de}",
}
```

### Disclaimer

This repository contains actively developed software. While it is open for contributions and use, it should be considered experimental and is primarily tested on Unix systems — use in production environments is at your own risk.
