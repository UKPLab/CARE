Study Deployment
----------------

This guide provides step-by-step instructions for setting up a CARE instance to support a thesis or project workflow.

.. note::

   For a detailed example including external GPU provider setup and broker integration,
   see the :doc:`Ruhr University Bochum Study <ruhr_uni_bochum_study>`.

Preliminary Organizational Preparation 
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Before starting deployment, prepare the following (Should be done several days in advance):

1. **Request Admin Access**:  
   Contact your system administrator and request admin or root access to the target server. Include a supervisor or project lead for approval if necessary.

2. **Register a Domain**:  
   Ask the system administrator to add a new A-record for your study domain. Provide the following details:

   - **Domain**: your-desired-subdomain.institution-domain.tld
   - **IP Address**: Public IP of the target machine
   - **Type**: A-record

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

**3. DNS and HTTPS Configuration**

Ask your sysadmin to register an A-record pointing to your server IP. Then, configure HTTPS:

.. note:: 
        Make sure that the DNS Entry is available outside of the TU Darmstadt (may need some time).

.. code-block:: bash

   cd /srv/nginx-certbot/ # direct yourself here
   nano init-letsencrypt.sh # add domain here
   sudo ./init-letsencrypt.sh

Update your NGINX configuration:

.. code-block:: nginx

   server {
       listen 80;
       server_name your.domain.tld;
       server_tokens off;

       location ^~ /.well-known/acme-challenge/ {
           root /var/www/certbot;
       }

       location / {
           return 301 https://$server_name$request_uri;
       }
   }

   server {
       listen 443 ssl;
       server_name your.domain.tld;
       server_tokens off;

       ssl_certificate /etc/letsencrypt/live/care.ukp.informatik.tu-darmstadt.de/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/care.ukp.informatik.tu-darmstadt.de/privkey.pem;
       include /etc/letsencrypt/options-ssl-nginx.conf;
       ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

       location / {
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header Access-Control-Allow-Origin *;
           proxy_pass http://172.19.0.1:<your_custom_port>/;

           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }

Restart the server:

.. code-block:: bash

   docker compose restart

Now the service should be available on: http://carethesis.ukp.informatik.tu-darmstadt.de , if it doesn't work in your Browser, try with an incognito tab first.

**4. Updating the Instance Without Deleting the Database**

To apply updates from your development branch to your deployment branch:

.. code-block:: bash

   cd /home/deployer/your_project_directory # go to deployer dir as su
   git checkout project-XX-name # go to our project dir
   git pull # pull the update from remote repo
   git checkout deploy-XX-name # switch to project deploy branch
   git merge project-XX-name # merge code
   git push --set-upstream origin deploy-XX-name # push project deploy code to remote repo

Then, rebuild the instance:

.. code-block:: bash

   docker ps | grep "your_keyword"  # Optional: locate container
   make CONTAINER=your_container_name backup_db # back up the db container for this instance
   cat .env # check out the config file, make sure everything still looks right
   make build # update the instance

Now test the instance in the front end, the bug should be solved already.

