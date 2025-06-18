Revision Workflow Study Example
-------------------------------

This example demonstrates how CARE can support a structured revision workflow to study how users revise and respond to AI-generated feedback. It enables natural editing of a given document, tracks changes, and summarizes them for further analysis.

The workflow follows a four-step process:

1. **Initial Revision** – users revise a pre-written text.  
2. **LLM Feedback** – model-generated suggestions are shown.  
3. **Second Revision** – users revise again, now with feedback.  
4. **Final Summary with LLM Feedback** – feedback and changes are presented in a modal.

This workflow is available in the CARE interface under the name **"Ruhr-Uni-Bochum-Project"**.

Prepare external GPU Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Use :ref:`gpu-provider-setup` setup guide

Prepare the broker
~~~~~~~~~~~~~~~~~~

Install broker locally

::

  cd /home/deployer
  git clone https://git.ukp.informatik.tu-darmstadt.de/zyska/CARE_broker.git my_broker
  git checkout <your-branch-name> # needs to be added on the server
  cd my_broker
  nano .env
  make docker

.env::

  PROJECT_NAME=my_broker
  BROKER_PORT=4858

Prepare the CARE Instance
~~~~~~~~~~~~~~~~~~~~~~~~~

1. Ask Sysadmin Team to add A-Record for new domain (in this case rub.ukp.informatik.tu-darmstadt.de)

2. Clone branch into subfolder and install CARE instance

::

  cd /home/deployer
  git clone https://git.ukp.informatik.tu-darmstadt.de/zyska/care.git my_care
  cd my_care
  git checkout <project-branch>
  git checkout -b deploy-<your-name>
  nano .env
  git add .env
  git commit
  git push --set-upstream origin deploy-<your-name>
  make build

.env::

  PROJECT_NAME=my_care
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

  # For your instance
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
  }

For deployment and server configuration (e.g., NGINX, certificates), please refer to the general CARE installation guide: :doc:`../getting_started/installation`.

Testing
~~~~~~~

1. Make sure the leaf.cloud server is running.  
2. Connect to VPN  
3. Run CARE locally with the latest branch  
4. Update the settings (``service → url``) with your **public broker URL**
5. Restart backend

----------------

.. _gpu-provider-setup:

Leaf.Cloud
~~~~~~~~~~

There are many external service providers for conducting studies with GPU resources, but only a few provide server capacities inside the EU allow accounting according to time of use. One of them is:

    https://leaf.cloud/ (up to four Nvidia V100)

This tutorial provides only the basics for using a GPU with CARE. For additional functionality, see the documentation of Leaf.Cloud under https://docs.leaf.cloud/en/latest/. For price calculation, see https://www.leaf.cloud/pricing/.

Prepare Leaf.Cloud
^^^^^^^^^^^^^^^^^^

.. note::

    It is assumed that an account already exists and money has been transferred to it.

For all steps, login to the OpenStack Dashboard (https://create.leaf.cloud/) first.

**Change language of the Dashboard**

Click on *Settings* on the top right and change the Language to *English (en)*. Click on *Save* to apply the change.

**Create Key Pairs for Server Login**

1. Click on *Compute* → *Key Pairs* → *Create Key Pair*

2. Fill out the form:

+----------------+---------------------------------------+---------------------+
| Field          | Description                           | Example             |
+================+=======================================+=====================+
| Key Pair Name  | Name of the key pairs                 | Login               |
+----------------+---------------------------------------+---------------------+
| Key Type       | Type of the key pairs                 | SSH Key             |
+----------------+---------------------------------------+---------------------+

3. After clicking *Create Key Pair*, a `.pem` file should download.

.. note::

    Of course, you can also create the key pairs externally and upload the public key using *Import Public Key*.

Create Instance
^^^^^^^^^^^^^^^

**Create Volume**

Create a new disk under *Volumes* → *Volumes* → *Create Volume*

+--------------------+-------------------------------------------+-------------------------------+
| Field              | Description                               | Example                       |
+====================+===========================================+===============================+
| Volume Name        | Name of the disk                          | Study Data                    |
+--------------------+-------------------------------------------+-------------------------------+
| Description        | Description of the disk                   | Space for LLM Model and       |
|                    |                                           | Study Data                    |
+--------------------+-------------------------------------------+-------------------------------+
| Volume Source      | Where to copy the disk from               | No source, empty volume       |
+--------------------+-------------------------------------------+-------------------------------+
| Type               | Type of the disk                          | encrypted                     |
+--------------------+-------------------------------------------+-------------------------------+
| Size               | Size of the disk                          | 150 GiB                       |
+--------------------+-------------------------------------------+-------------------------------+
| Availability Zone  | Where the disk should be placed           | europe-nl-ams1                |
+--------------------+-------------------------------------------+-------------------------------+
| Group              |                                           | No Group                      |
+--------------------+-------------------------------------------+-------------------------------+

**Create Instance**

Create an instance under *Compute* → *Instances* → *Launch Instance*

+-------------------------+------------------------------------+-----------------------------+
| Field                   | Description                        | Example                     |
+=========================+====================================+=============================+
| Instance Name           | Name of the instance               | Study Server                |
+-------------------------+------------------------------------+-----------------------------+
| Volume Size (GB)        | Size of the disk                   | 20                          |
+-------------------------+------------------------------------+-----------------------------+
| Source Allocated        | Operation System                   | Debian-12                   |
+-------------------------+------------------------------------+-----------------------------+
| Networks                | Communication channel              | external                    |
+-------------------------+------------------------------------+-----------------------------+
| Flavor                  | Server Capacity                    | eg1.a100x1.V12-84           |
+-------------------------+------------------------------------+-----------------------------+
| Key Pair                | Key Pair for SSH access            | Server-Login                |
+-------------------------+------------------------------------+-----------------------------+

With *Launch Instance* the instance will be created. This takes around two minutes.

.. important::

    Note down the IP address.

**Attach Volume**

Click on the previously created instance, **Attach Volume**, and select the volume with the study data.

Working with the Instance
^^^^^^^^^^^^^^^^^^^^^^^^^

You need the private key file (``login.pem``) and the IP address of the instance.

**Login per SSH** ::

  chmod 0600 login.pem
  ssh -i login.pem debian@<ip>

**Mount Volume** ::

  sudo apt update
  sudo apt install fdisk
  sudo fdisk -l
  # sudo fdisk /dev/vdb
  sudo mkfs.ext4 /dev/vdb  # only once when the volume is created
  sudo mount /dev/vdb /srv

  # Mount on boot
  sudo blkid  # copy UUID from /dev/vdb
  sudo nano /etc/fstab
  # Add: UUID=<copied UUID> /srv ext4 defaults 0 0

**Install NVIDIA Driver**

Add to ``/etc/apt/sources.list``::

  deb http://deb.debian.org/debian/ bookworm main contrib non-free non-free-firmware

and execute::

  sudo apt update
  sudo apt install nvidia-driver firmware-misc-nonfree
  sudo reboot
  nvidia-smi  # check if GPU is available

This should look like this::

  Fri Feb  7 08:43:10 2025       
  +---------------------------------------------------------------------------------------+
  | NVIDIA-SMI 535.216.01             Driver Version: 535.216.01   CUDA Version: 12.2     |
  |-----------------------------------------+----------------------+----------------------+
  | GPU  Name                 Persistence-M | Bus-Id        Disp.A | Volatile Uncorr. ECC |
  | Fan  Temp   Perf          Pwr:Usage/Cap |         Memory-Usage | GPU-Util  Compute M. |
  |                                         |                      |               MIG M. |
  |=========================================+======================+======================|
  |   0  NVIDIA A100 80GB PCIe          On  | 00000000:00:05.0 Off |                    0 |
  | N/A   48C    P0              49W / 300W |      0MiB / 81920MiB |      0%      Default |
  |                                         |                      |             Disabled |
  +-----------------------------------------+----------------------+----------------------+                                                                                       
  +---------------------------------------------------------------------------------------+
  | Processes:                                                                            |
  |  GPU   GI   CI        PID   Type   Process name                            GPU Memory |
  |        ID   ID                                                             Usage      |
  |=======================================================================================|
  |  No running processes found                                                           |
  +---------------------------------------------------------------------------------------+

**Install Conda**

::

  cd /srv
  sudo curl -O https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
  sudo chmod +x Miniconda3-latest-Linux-x86_64.sh
  sudo bash Miniconda3-latest-Linux-x86_64.sh
  # change location to /srv/miniconda3
  sudo su -
  conda info

Install broker for testing
^^^^^^^^^^^^^^^^^^^^^^^^^^

.. note::

   For security, configure the firewall to only allow inbound requests from specific IP addresses,
   especially before starting any network services like the broker.

**Install Docker**

From https://docs.docker.com/engine/install/debian/#install-using-the-repository : ::

  sudo apt-get update
  sudo apt-get install ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update
  sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo docker run hello-world

**Install BrokerIO** ::

  sudo apt install git
  git clone https://github.com/UKPLab/CARE_broker.git /srv/brokerio
  cd /srv/brokerio
  docker compose -f docker-compose.yml -p "brokerio" up --build -d
  docker ps

The broker should now be running on ``127.0.0.1:4852``.

IMPORTANT! Shelve Instance
^^^^^^^^^^^^^^^^^^^^^^^^^^

.. important::

    To save money, after usage the server shut be shelved.

1. Open the OpenStack Dashboard (`https://create.leaf.cloud/`)
2. Click on **Compute → Instances** and select the **Study Server**
3. On the right is the **Actions Panel**, click the small arrow 
4. Click on **Shelve Instance**

The instance status should be **Shelved Offloaded** now! Make sure this is the status.

If you want to use the instance again, click in the same **Actions** panel on  **Unshelve Instance**.


QR_Setup Guide 
^^^^^^^^^^^^^^

1. Environment Setup
^^^^^^^^^^^^^^^^^^^^

**1.0 Before We Start**

1. Start the Study Server via the Leaf.Cloud dashboard.  
2. Save the Login Certificate: Save ``login.pem`` in a local folder named ``leaf_cloud``.  
3. Connect to the server using SSH (e.g., from a terminal in ``leaf_cloud``):

.. code-block:: bash

    chmod 0600 login.pem
    ssh -i login.pem debian@45.135.58.93

When prompted, type `yes` to continue.

**1.1 Install Environment for Model Execution**

1. Upload the Code Folder from the local machine to the Server:

.. code-block:: bash

    scp -i login.pem -r <model> debian@<ip>:/srv/


2. Create and Activate a Conda Environment:

.. code-block:: bash

    #Set permissions to create env in /srv/miniconda3 (avoid using /home/debian due to limited space)
    sudo chown -R debian:debian /srv/miniconda3

    # Create environment, python 3.12 is required by the current version of brokerio (GitLab)
    conda create --prefix /srv/miniconda3/envs/my_env python=3.12 -y

    # Activate the environment
    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env

    # Install required packages, clear pip cache first
    pip cache purge
    pip install --cache-dir /srv/miniconda3/cache -r /srv/<model>/requirements.txt

.. note::

   You may need to upload and configure your own model under ``/srv/<model>/model/`` depending on your use case.


2. Test NLP Model with Internal Broker
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**2.0 Ensure the broker is running before executing the skill. Install the brokerio package from GitLab**

::

    sudo docker ps
    pip install git+https://git.ukp.informatik.tu-darmstadt.de/zyska/CARE_broker.git

**2.1 Run my_skill.py**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/<model>/my_skill.py 

**Output**

::

    (my_env) debian@study-server:~$ python /srv/<model>/my_skill.py
    2025-02-12 17:44:10,437 - INFO - 🚀 Skill client started
    2025-02-12 17:44:14,978 - INFO - 🔄 Attempting to connect to broker: http://127.0.0.1:4852
    2025-02-12 17:44:15,018 - INFO - ✅!!!! Connected to broker at http://127.0.0.1:4852
    2025-02-12 17:44:15,018 - INFO - 🗑️ Unregistering skill before re-registering...
    2025-02-12 17:44:17,018 - INFO - 📤 Sending skill registration...
    2025-02-12 17:44:17,018 - INFO - ✅ Skill registration event emitted!

**2.2 Run test_request_eic.py in a second terminal when the skill is registered**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/<model>/test_request_eic.py

**2.3 Monitor Broker Logs in a third terminal if needed**

::

    sudo docker logs brokerio-broker-1 --follow

**Notes**

The `my_skill.py` is running in `'spawn'` mode to avoid multiprocessing conflicts

::

    ctx = mp.get_context('spawn')  # Change 'fork' to 'spawn'
    client = ctx.Process(target=skill_client, args=(BROKER_URL, skill_definition))
    client.start()

The NLP results are sent back to the broker and received by the request client.
They are also saved on the study server under the folder `/srv/<model>/data`,
with the taskRequest ID in the subfolder names. Each subfolder contains the original
and revised documents, as well as classification results, allowing for manual analysis if needed.

3. Skill Diff: Get the Deltas Only
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**3.1 Run skill_diff.py**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/<model>/skill_diff.py

**3.2 Run test_request_diff.py in a second terminal when the skill is registered**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/<model>/test_request_diff.py

4. Make my_skill2 Automatically Started When Restarting the Server
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**4.1 Create start_my_skill.sh**

::

    #!/bin/bash
    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env  # Activate Conda environment
    python /srv/<model>/my_skill2.py  # Run the script

**4.2 Enable autostart**

::

    # make it runable
    chmod +x /srv/<model>/start_my_skill.sh
    # create the service file
    sudo nano /etc/systemd/system/my_skill.service
    # copy paste:
    [Unit]
    Description=Start my_skill2 service
    After=network.target

    [Service]
    Type=simple
    ExecStart=/srv/<model>/start_my_skill.sh
    Restart=always
    User=debian
    StandardOutput=journal
    StandardError=journal

    [Install]
    WantedBy=multi-user.target

::

    # enable the service
    sudo systemctl daemon-reload
    sudo systemctl enable my_skill.service


Logs can be found with:

::

    journalctl -u my_skill.service -f

.. note::

   To integrate your own model or define custom skills for the broker system,
   please refer to the `CARE_broker documentation <https://github.com/UKPLab/CARE_broker>`_.

