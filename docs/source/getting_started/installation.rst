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

    On Windows, you can use the ``make`` command with the `GNU Make for Windows <http://gnuwin32.sourceforge.net/packages/make.htm>`_ package.
    On newer windows systems, simply use ``winget install GnuWin32.Make`` and make it executable with ``set PATH=%PATH%;C:/Program Files (x86)/GnuWin32/bin``.

.. note::

    On Ubuntu, you need to install the docker compose plugin with ``sudo update && sudo apt-get install docker-compose-plugin``.

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

Nginx / Certbot
---------------

We recommend to use nginx as a reverse proxy for the application and Certbot to support SSL.

To install nginx and Certbot, run the following commands (adapted from this `Implementation <https://github.com/wmnnd/nginx-certbot>`_):

.. code-block:: bash

    # Install Docker Compose if not already installed
    sudo pip3 install docker-compose
    sudo chmod 666 /var/run/docker.sock

    # Clone Project
    sudo git clone https://github.com/wmnnd/nginx-certbot.git /srv/nginx-certbot
    cd /srv/nginx-certbot

    # Modify Configuration
    sudo nano init-letsencrypt.sh
    sudo nano data/nginx/app.conf

    # Run Script for first generation process of the certificate
    sudo ./init-letsencrypt.sh

    # Run docker-compose to generate all docker instances
    sudo docker-compose up -d

Now the ssl certificate should be available and will be renewed periodically.

.. tip::

    In the file docker-compose.yml you can add additional volumes to the service nginx (e.g., ./data/nginx/html:/var/www/html) to make further html files available.

A sample configuration for nginx ``./data/nginx/app.conf`` can look like this:

.. code-block:: bash

    ### This part is for certificate updates and SSL Page Redirection
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

    # For main environment
    server {
        listen 443 ssl;
        server_name <your domain>;
        server_tokens off;

        ssl_certificate /etc/letsencrypt/live/<your domain>/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/<your domain>/privkey.pem;
        include /etc/letsencrypt/options-ssl-nginx.conf;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

        location / {
            #proxy_redirect off
            proxy_set_header    Host                $host;
            proxy_set_header    X-Real-IP           $remote_addr;
            proxy_set_header    X-Forwarded-For     $proxy_add_x_forwarded_for;
            proxy_set_header Access-Control-Allow-Origin *;
            proxy_pass http://<docker ip>:<app port>/;

            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

.. warning::

    The IP-Address can change, if the docker network is newly created! Please adapt the ip address accordingly!
    A better way is to reload just the config with ``sudo docker-compose restart``.