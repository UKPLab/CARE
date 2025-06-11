Ruhr University Bochum Study
----------------------------

In cooperation with the Ruhr University in Bochum, CARE should be extended to be able to investigate to what extent AI-generated text is treated differently during revision. For this purpose, CARE should offer the possibility to natural change a document text, where the edits will be saved and subsequently analyzed and presented in a summary.

It uses the NLP integration via an external GPU provider.

Prepare external GPU Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Use :doc:`Leaf.Cloud setup guide <leaf.cloud>`

Prepare the broker
~~~~~~~~~~~~~~~~~~

1. Ask Sysadmin Team to open the open port 4858 for the broker and limit connections to the IP Address of the external GPU provider  

.. note::

        Info: On firewall only allow inbound requests from specific IP address

2. Install broker locally

::

  cd /home/deployer
  git clone https://git.ukp.informatik.tu-darmstadt.de/zyska/CARE_broker.git rummels_brokerio
  git checkout project-23-rummels # needs to be added on the server
  cd rummels_brokerio
  nano .env
  make docker

.env::

  PROJECT_NAME=rummels_brokerio
  BROKER_PORT=4858

Prepare the CARE Instance
~~~~~~~~~~~~~~~~~~~~~~~~~

1. Ask Sysadmin Team to add A-Record for new domain (in this case rub.ukp.informatik.tu-darmstadt.de)

2. Clone branch into subfolder and install CARE instance

::

  cd /home/deployer
  git clone https://git.ukp.informatik.tu-darmstadt.de/zyska/care.git rummels
  cd rummels
  git checkout project-23-rummels
  git checkout -b deploy-23-rummels
  nano .env
  git add .env
  git commit
  git push --set-upstream origin deploy-23-rummels
  make build

.env::

  PROJECT_NAME=rummels_care
  PUBLISHED_PORT=8992
  POSTGRES_URL=postgres
  RPC_MOODLE_HOST=rpc_moodle
  RPC_MOODLE_PORT=8081
  ADMIN_PWD=PjGcbLEUDEH93PY

3. Update NGINX and Certificates

.. note::

        Make sure that the DNS Entry is available outside of the TuDa (may need some time)

::

  cd /srv/nginx-certbot
  sudo nano init-letsencrypt.sh # add domain here
  sudo ./init-letsencrypt.sh # reinit

::

  cd /srv/nginx-certbot
  sudo nano data/nginx/app.conf 
  docker compose restart

data/nginx/app.conf::

  # For rummels instance
  server {
      listen 80;
      server_name rub.ukp.informatik.tu-darmstadt.de;
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
      server_name rub.ukp.informatik.tu-darmstadt.de;
      server_tokens off;

      ssl_certificate /etc/letsencrypt/live/care.ukp.informatik.tu-darmstadt.de/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/care.ukp.informatik.tu-darmstadt.de/privkey.pem;
      include /etc/letsencrypt/options-ssl-nginx.conf;
      ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

      # if some service is not available
      error_page 501 502 503 /maintenance.html;
      location = /maintenance.html {
          root /var/www/html;
      }

      location / {
          #proxy_redirect off     
          proxy_set_header    Host                $host;
          proxy_set_header    X-Real-IP           $remote_addr;
          proxy_set_header    X-Forwarded-For     $proxy_add_x_forwarded_for;
          proxy_set_header Access-Control-Allow-Origin *;
          proxy_pass http://172.19.0.1:8992/;

          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
      }
  }

Testing
~~~~~~~

1. Make sure the leaf.cloud server is running.  
2. Connect to VPN  
3. Run CARE locally with the latest branch  
4. Change Settings (service --> url) with broker url: http://rub.ukp.informatik.tu-darmstadt.de:4858  
5. Restart backend