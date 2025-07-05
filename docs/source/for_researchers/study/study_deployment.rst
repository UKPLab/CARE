Study Deployment
----------------

This guide provides step-by-step instructions for setting up a CARE instance to support a thesis or project workflow.

.. note::

   For a detailed example including external GPU provider setup, broker integration and nlp integration,
   see the :doc:`Revision Workflow Study Example <study_with_nlp>`.

Prepare Your Server Environment
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Before deploying CARE for a study project, please ensure that your server is properly configured.

- The server must be accessible under a public domain.
- NGINX and HTTPS (Certbot) should be configured.
- Docker and Docker Compose must be installed.

For a full guide on setting up a reverse proxy, domain (A-record), SSL, and Docker environment, see the :doc:`Installation Guide <../../getting_started/installation>`.

Once the server is ready, you can proceed with cloning and configuring your specific CARE instance below.

Prepare the CARE instance
~~~~~~~~~~~~~~~~~~~~~~~~~

**1. Clone the Repository & Create Branches**

.. code-block:: bash

   sudo su 
   cd /home/deployer
   git clone <your_repo_url> your_project_directory
   cd your_project_directory
   git checkout dev
   git pull

   # Create branches
   git checkout -b project-XX-name # serve as a backup for this instance
   git push --set-upstream origin project-XX-name
   git checkout -b deploy-XX-name # we will config in this branch then

.. note::

   We recommend working on a separate ``deploy`` branch because it allows you to make local changes to environment-specific files like ``.env`` without affecting your main development branch.  
   This way, you can update your deploy branch by merging from the original project branch later — without overwriting your deployment-specific settings.

**2. Create and Configure `.env` File**

Create an .env file via nano .env (make sure you know how to use terminal-based IDE, e.g. nano or vim). And you have to modify the following entries:

.. code-block:: text

   PROJECT_NAME=your_project_name
   PUBLISHED_PORT=your_port # you have to find an unused port, try in your browser to find an unoccupied one
   POSTGRES_HOST=postgres
   RPC_MOODLE_HOST=rpc_moodle
   RPC_MOODLE_PORT=8081
   ADMIN_PWD=your_secure_admin_password

Check and commit the config:

.. code-block:: bash

   cat .env # check if you've saved it properly
   git add .env
   git commit -m "add env config"
   git push --set-upstream origin deploy-XX-name # you can check if the file is pushed to the remote repo
   make build # if everything looks fine, go compile it

