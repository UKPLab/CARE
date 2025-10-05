Installation
============

To get started quickly, follow the instructions below.

For a complete overview on building, development and deployment options
checkout the :doc:`Before You Start <../for_developers/before_you_start>` option.

Prerequisites
-------------

Docker is required to build the containers.
Please install them according to the official documentation:

* `Docker <https://docs.docker.com/engine/installation/>`_

or install Docker Desktop:

* `Docker Desktop for Windows <https://docs.docker.com/docker-for-windows/install/>`_
* `Docker Desktop for Mac <https://docs.docker.com/desktop/install/mac-install/>`_
* `Docker Desktop for Linux <https://docs.docker.com/desktop/install/linux-install/>`_

Also make sure that you have GNU's ``make`` installed on your system.

.. note::

    **Windows**

    You can use the ``make`` command with the `GNU Make for Windows <http://gnuwin32.sourceforge.net/packages/make.htm>`_ package.
    On newer windows systems, simply use ``winget install GnuWin32.Make`` and make it executable with ``set PATH=%PATH%;C:/Program Files (x86)/GnuWin32/bin``.

    ``make`` via Cygwin is not supported, because it is not compatible with nodejs (see `common_errors`_).

.. note::

    **Debian/Ubuntu**

    You need to install the docker compose plugin with ``sudo update && sudo apt-get install docker-compose-plugin``.

Build
-----

Before building the containers, you can change the basic configuration in the ``.env.main`` file.
To build the containers, run the following command:

.. code-block:: bash

    $ make ENV=main build

This command will build the containers.

The application should be available at http://localhost:9090

.. note::

    The credentials for the admin user can be also found in the .env file!

Install the mailserver
----------------------

In the basic configuration, the mailserver uses the localhost host machine as the mail relay.

We test the mail server with a `postfix <https://www.postfix.org/>`_ installation on the host machine.
Therefore, it is important to allow relaying from the docker network.
To allow relaying from the docker network, you need to add the following lines to the ``/etc/postfix/main.cf`` file:

.. code-block:: config

    inet_interfaces = all # or specify the interface
    mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128 172.19.0.0/16

Please adapt the IP range to your docker network (check with ``docker network inspect bridge``).
Then restart postfix with ``sudo systemctl restart postfix``.
Configure postfix according to your institution's guidelines.

.. note::

    If you want to change the settings (e.g., using an external SMTP server or disable it), you can change the settings in the frontend dashboard under "Settings".
    If you disable the mail server, make sure you also disable email notifications/verification.



Updating the Instance and Backing Up the Database
-------------------------------------------------

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

Rebuilding only the Moodle RPC container
----------------------------------------

If you touch any code under ``utils/rpcs/moodleAPI/`` run:

.. code-block:: bash

    $ make rpc_moodle_build

This rebuilds the *rpc_moodle* image and restarts that service without
affecting Postgres or the test-RPC container.

.. _a_record_preparation:

Preparing the Server and Access
-------------------------------

Before starting deployment, prepare the following (Should be done several days in advance):

1. **Request Admin Access**:  
   Contact your system administrator and request admin or root access to the target server. Include a supervisor or project lead for approval if necessary.

2. **Register a Domain**:  
   Ask the system administrator to add a new A-record for your study domain. Provide the following details:

   - **Domain**: your-desired-subdomain.institution-domain.tld
   - **IP Address**: Public IP of the target machine
   - **Type**: A-record

.. note:: 
        Make sure that the DNS Entry is available outside of the TU Darmstadt (may need some time).


Nginx / Certbot
---------------

We recommend to use nginx as a reverse proxy for the application and Certbot to support SSL.

To install nginx and Certbot, run the following commands (adapted from this `Implementation <https://github.com/wmnnd/nginx-certbot>`_):

.. code-block:: bash

    sudo chmod 666 /var/run/docker.sock

    # Clone Project
    sudo git clone https://github.com/wmnnd/nginx-certbot.git /srv/nginx-certbot
    cd /srv/nginx-certbot

    # Modify Configuration
    sudo nano init-letsencrypt.sh
    sudo nano data/nginx/app.conf

    # Run Script for first generation process of the certificate
    sudo ./init-letsencrypt.sh

    # Run docker compose to generate all docker instances
    sudo docker compose up -d

Once the A-record (:ref:`a_record_preparation`) has been registered and propagated, and the script executed, the SSL certificate should now be available and will be renewed periodically.
.. tip::

    In the file ``docker-compose.yml`` you can add additional volumes to the service nginx (e.g., ./data/nginx/html:/var/www/html) to make further html files available.

.. code-block:: nginx

    ### This part is for certificate updates and SSL redirection
    server {
        listen 80;
        server_name <your domain>;
        server_tokens off;

        location ^~ /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # Main server block for application access via HTTPS
    server {
        listen 443 ssl;
        server_name <your domain>;
        server_tokens off;

        ssl_certificate /etc/letsencrypt/live/<your domain>/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/<your domain>/privkey.pem;
        include /etc/letsencrypt/options-ssl-nginx.conf;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

        location / {
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Access-Control-Allow-Origin *;
            proxy_pass http://<docker ip>:<app port>/;

            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

.. warning::

   The IP address can change if the Docker network is recreated! Please adapt the IP address in the config accordingly.

   A better way is to reload just the configuration using:

   .. code-block:: bash

       docker compose restart

Now the service should be available at your configured domain. If it doesn't appear to work in your browser, try accessing it in an incognito/private tab first.

.. _common_errors:

Possible errors
---------------

Wrong make file
^^^^^^^^^^^^^^^

.. code-block:: bash

    /bin/bash: /cygdrive/c/Program Files/nodejs/npm: No such file or directory
    make: *** [backend/node_modules/.uptodate] Error 127

This is usually an error with the wrong make file installed with cygwin, which is not compatible with nodejs.
Please install the GNU make for Windows as described above.

Further make sure that the path to the make executable is correctly set in the PATH variable.
You can check which make is used with ``where make`` (under Windows).

.. note::

    In case of doubt, you can uninstall the cygwin make with the installer package manager ``setup-x86_64.exe`` of `Cygwin <https://cygwin.com/install.html>`_.



