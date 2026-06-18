# CARE — Internal Contributor Guide

**Who this is for:** Employees, researchers, student assistants (SHKs), thesis students, and project team members joining CARE as part of the UKP Lab at TU Darmstadt.

For external open-source contributors, see [CONTRIBUTING.md](./CONTRIBUTING.md) instead.

---

## Table of Contents

- [Step 1 — Get Your UKP Account and Access](#step-1--get-your-ukp-account-and-access)
- [Step 2 — Activate Your TU Darmstadt Identity](#step-2--activate-your-tu-darmstadt-identity)
- [Step 3 — Set Up Your Device and Tools](#step-3--set-up-your-device-and-tools)
- [Step 4 — Join the Team Communication](#step-4--join-the-team-communication)
- [Step 5 — Join Leantime](#step-5--join-leantime)
- [Step 6 — Learn the Internal Wiki](#step-6--learn-the-internal-wiki)
- [Step 7 — Explore CARE as a User Before Writing Code](#step-7--explore-care-as-a-user-before-writing-code)
- [Step 8 — Run CARE Locally](#step-8--run-care-locally)
- [Step 9 — Understand the Repository Structure](#step-9--understand-the-repository-structure)
- [Step 10 — Git Workflow and Branching Rules](#step-10--git-workflow-and-branching-rules)
- [Step 11 — Working on Issues](#step-11--working-on-issues)
- [Step 12 — Code Review and Pull Requests](#step-12--code-review-and-pull-requests)
- [Step 13 — Your First Real Task](#step-13--your-first-real-task)
- [Step 14 — Team Responsibilities and Recurring Obligations](#step-14--team-responsibilities-and-recurring-obligations)
- [When Something Is Missing or Broken](#when-something-is-missing-or-broken)
- [SSH Troubleshooting](#ssh-troubleshooting)

---

Complete this sequence in order. Skipping steps causes unnecessary delays.

### Internal systems you will need access to

| System | Purpose |
|---|---|
| GitHub — [github.com/UKPLab/CARE](https://github.com/UKPLab/CARE) | Primary development repository (public) |
| GitLab — [git.ukp.informatik.tu-darmstadt.de/zyska/care](https://git.ukp.informatik.tu-darmstadt.de/zyska/care) | Internal mirror, deployment CI, boards |
| UKP Wiki | Internal knowledge base, processes, meeting notes |
| Matrix / Elements | Day-to-day team communication |
| Leantime — [plan.care.ukp.informatik.tu-darmstadt.de][leantime-url] | Project and task planning (synced with GitHub issues) |

---

## Step 1 — Get Your UKP Account and Access

After your onboarding paperwork is processed, you will receive an email from the sysadmin team with your UKP account credentials.

With your UKP credentials you should have access to:

- The internal GitLab repository
- The UKP Matrix chat server (via the Elements client)
- The UKP Wiki

If any of these is missing, contact your supervisor or the sysadmin team immediately.

> Development and day-to-day collaboration happen on GitHub. GitLab is the internal mirror used for deployment CI. Always assume GitHub is the remote you work against unless told otherwise.

---

## Step 2 — Activate Your TU Darmstadt Identity

After your contract is processed you will receive a separate email to activate your TU-ID.

This is required for your university email address and access to TU-ID authenticated services.

> If you join as a UKP Lab member, you may have separate UKP onboarding instructions. See the UKP wiki at: \[insert UKP wiki url\]

---

## Step 3 — Set Up Your Device and Tools

| Tool | Minimum version | Check |
|---|---|---|
| Git | any recent | `git --version` |
| Node.js | 23.x | `node --version` |
| npm | ships with Node | `npm --version` |
| Docker | any recent | `docker --version` |
| Docker Compose | v2 (plugin) | `docker compose version` |
| GNU Make | any | `make --version` |

> **Windows:** Make is not installed by default. Run `winget install GnuWin32.Make` and add `C:\Program Files (x86)\GnuWin32\bin` to your PATH.

### GitHub access

Ask your mentor or maintainer to add you to the UKPLab GitHub organization before you start working on issues.

### Configure Git identity

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your-github-email@example.com"
```

### Authentication

Use SSH (recommended) or HTTPS. See [GitHub's SSH guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

```bash
git clone --recursive git@github.com:UKPLab/CARE.git
```

---

## Step 4 — Join the Team Communication

The main communication platform is UKP Matrix Chat, accessed via the Elements client. Log in as soon as your UKP account is active.

---

## Step 5 — Join Leantime

Leantime is available at: \[leantime-url\]

The project maintainer will send you an invite email. Leantime is synced with GitHub issues and gives the team a planning view over tasks. Ask your mentor to walk you through the workflow for your role.

---

## Step 6 — Learn the Internal Wiki

There are two wikis:

- UKP Lab wiki (administrative): \[insert UKP wiki url\]
- CARE project wiki: https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/home

Read these sections before writing any code:

| Link | Content |
|---|---|
| [Repository Workflows](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Repository%20Workflows) | How to create feature branches and manage the Git workflow |
| [Peer Code Reviews](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Peer%20Code%20Reviews) | Checklist for code reviews |
| [Documentation](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Documentation) | Documentation responsibilities |
| [Labels](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Labels) | Using labels for task management |
| [Milestones](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Milestones) | How milestones are categorized |
| [Deployment](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Deployment) | Deployment checklist |
| [GitHub Guide](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/GitHub-Guide) | Development guidelines on GitHub |
| [Team Responsibilities](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Team-Responsibilities) | What each role is responsible for |

---

## Step 7 — Explore CARE as a User Before Writing Code

Use the product before touching the codebase.

Demo: https://demo.care.ukp-lab.de

Go through the interface as both a researcher (upload a document, create a study) and a participant (annotation step, editor step).

---

## Step 8 — Run CARE Locally

Follow the setup guide: [docs/source/for_developers/before_you_start.rst](docs/source/for_developers/before_you_start.rst)

The short version:

```bash
make docker   # start the database and RPC containers
make init     # install dependencies and run migrations
```

Then in two separate terminals:

```bash
make dev-backend
make dev-frontend
```

Open http://localhost:3000 and log in with `ADMIN_EMAIL` / `ADMIN_PWD` from your `.env`.

---

## Step 9 — Understand the Repository Structure

```
CARE/
├── backend/
│   ├── index.js                  <- Entry point
│   ├── webserver/
│   │   ├── Server.js             <- Express, sessions, Passport, auto-discovery
│   │   ├── Socket.js             <- BASE CLASS for all socket handlers
│   │   ├── Service.js            <- BASE CLASS for long-running services
│   │   ├── RPC.js                <- BASE CLASS for RPC connections
│   │   ├── sockets/              <- Domain socket handlers (auto-discovered)
│   │   ├── services/             <- nlp.js, backgroundTask.js
│   │   ├── rpcs/                 <- pdfRPC.js, moodleRPC.js
│   │   └── routes/               <- auth.js, config.js (REST only)
│   ├── db/
│   │   ├── MetaModel.js          <- BASE CLASS for all database models
│   │   ├── models/               <- All Sequelize model files
│   │   └── migrations/           <- Timestamped schema migration files
│   └── tests/                    <- Jest tests
│
├── frontend/
│   └── src/
│       ├── main.js               <- Vue, Vuex, Router, Socket.IO all wired here
│       ├── App.vue               <- Root component, socket bootstrap
│       ├── router.js             <- All routes with auth guards
│       ├── store/
│       │   ├── index.js          <- Vuex store
│       │   └── utils.js          <- createTable for autoTable schema
│       ├── plugins/
│       │   └── subscribeTable.js <- Global mixin for auto data subscription
│       ├── basic/                <- Reusable base UI components
│       └── components/           <- Domain components
│
├── utils/modules/editor-delta-conversion/   <- Shared local npm package
├── Makefile                      <- All dev commands
├── docker-compose.yml            <- Production orchestration
└── docker-dev.yml                <- Dev override (exposes DB + RPC ports)
```

### Read these five files before writing any code

| File | What it teaches you |
|---|---|
| `backend/db/MetaModel.js` | Base class for all DB models: soft deletes, autoTable, transaction hooks |
| `backend/webserver/Socket.js` | Base class for all socket handlers: createSocket, broadcastTable, RBAC |
| `backend/webserver/Server.js` | How the app boots: Express, Passport, auto-discovery of sockets/services |
| `backend/webserver/sockets/app.js` | The central socket: appInit, subscribeAppData, generic CRUD |
| `frontend/src/plugins/subscribeTable.js` | How components automatically subscribe to live data |

For a deeper technical explanation, see the official documentation at https://care.ukp.informatik.tu-darmstadt.de/docs/

---

## Step 10 — Git Workflow and Branching Rules

The git workflow is documented in [docs/source/for_developers/contributing.rst](docs/source/for_developers/contributing.rst). The rules below apply to internal contributors in the same way.

### Protected branches

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready. Protected. Maintainers only. |
| `dev` | Active development. Protected. All feature branches target here. |

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat-ISSUENUMBER-shortname` | `feat-42-add-export` |
| Child of feature | `feat-ISSUENUMBER-FNAME-CHILDNUM-childname` | `feat-42-add-export-101-csv-format` |
| Project / thesis | `project-MILESTONE-projectname` | `project-28-ukpthesis` |
| Sub-branch of project | `project-MILESTONE-name-FEATNUM-featname` | `project-28-ukpthesis-5-auth-fix` |
| Hotfix | `hotfix-ISSUENUMBER` | `hotfix-99-login-crash` |
| Release | `release-MILESTONENUMBER` | `release-5` |

### Starting a branch

```bash
git checkout dev
git pull
git checkout -b feat-ISSUENUMBER-shortname dev
```

### Commit message format

```
<type>: <short description in present tense>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `style`, `ci`, `chore`

Rules: present tense, lowercase, no period, one logical change per commit.

Good: `fix: resolve race condition in document edit queue`

### Syncing with dev before a PR

```bash
git checkout dev && git pull
git checkout feat-ISSUENUMBER-shortname
git merge dev && git push
```

### GitHub vs GitLab

Default for all development is GitHub. The `dev` and `main` branches sync automatically to GitLab after a successful CI build. See the [GitHub Guide](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/GitHub-Guide) for manual sync commands.

---

## Step 11 — Working on Issues

Every change should have an associated GitHub issue. One issue can contain multiple smaller tasks but should represent one coherent piece of work for one developer.

Use milestones to group issues for a planned release. Milestones are created by project maintainers only.

Issue templates are available at https://github.com/UKPLab/CARE/issues/new/choose. Apply labels to every issue.

---

## Step 12 — Code Review and Pull Requests

Both `dev` and `main` are protected. A code review by at least one other developer is mandatory before merging.

Read the [Peer Code Reviews](https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/wikis/Peer%20Code%20Reviews) wiki page for the full checklist and PR template.

The PR title format and description template are documented in [contributing.rst](docs/source/for_developers/contributing.rst).

---

## Step 13 — Your First Real Task

Pick an issue, create a branch from `dev`, make a focused change, test locally, and open a pull request. Good starting points: small visible bugs, UI label corrections, missing test cases, or documentation improvements.

---

## Step 14 — Team Responsibilities and Recurring Obligations

**Everyone must:**

- Keep the Absence Calendar up to date
- Submit working hours monthly (student assistants: by Friday noon before the Weekly Meeting)
- Notify supervisors in advance of absences longer than a day

**Role-specific responsibilities:**

| Area | What it involves |
|---|---|
| Website | Keeping the public CARE website and team page updated (WordPress) |
| Protocols | Writing and managing weekly meeting protocols |
| Server | Server updates, instance updates, regular backups |
| GitHub | Repository maintenance, labels, old branches, Dependabot escalations |
| Documentation | Keeping docs current |
| Marketing | Job postings, social media |

Ask your supervisor which responsibilities are assigned to you.

---

## When Something Is Missing or Broken

| Situation | What to do |
|---|---|
| Missing account access | Contact the sysadmin team or your supervisor |
| Local setup fails | Post the exact error in the Elements channel |
| CI/CD pipeline fails | Read the pipeline logs |
| Documentation is outdated | Get the answer, then fix the documentation |
| Priorities are unclear | Ask your supervisor directly |

---

## SSH Troubleshooting

**Error: "no matching host key type found"**

```
Unable to negotiate with <ip> port 22: no matching host key type found. Their offer: ssh-rsa
```

Fix:

```bash
echo "PubkeyAcceptedAlgorithms +ssh-rsa" >> ~/.ssh/config
echo "HostKeyAlgorithms +ssh-rsa" >> ~/.ssh/config
```

On macOS, edit `/etc/ssh/ssh_config` with the same lines instead.

---

*CARE is an open-source platform published by the UKP Lab at TU Darmstadt (ACL 2023).*
*Contact: dennis.zyska@tu-darmstadt.de · nils.dycke@tu-darmstadt.de*

[leantime-url]: https://plan.care.ukp.informatik.tu-darmstadt.de
