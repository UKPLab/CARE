Installation
============

To get started quickly, follow the below instructions.
For a complete overview on building, development and deployment options
checkout the :doc:`Before You Start <for_developers/before_you_start>` option.
If you simply want to run a user or annotation study, follow this guide.

Prerequisites
-------------

Docker and docker-compose are required to build the containers.
Please install them according to the official documentation:

* `Docker <https://docs.docker.com/engine/installation/>`_
* `Docker Compose <https://docs.docker.com/compose/install/>`_

Also make sure that you have GNU's ``make`` installed on your system.

Build
-----

Before building the containers, you can change the basic configuration in the ``.env`` file.
To build the containers, run the following command:

.. code-block:: bash

    $ make build

This command will build the containers.

The application should be available at http://localhost:8080

.. note::

    The credentials for the admin user can be found in the .env file!

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

.. note::

    The IP-Address can change, if the docker network is newly created, then it must also be adapted.
    Therefore you should use for reloading the config the command ``sudo docker-compose restart`` instead!