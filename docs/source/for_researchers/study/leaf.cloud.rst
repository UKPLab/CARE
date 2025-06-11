Leaf.Cloud
----------

There are many external service providers for conducting studies with GPU resources, but only a few provide server capacities inside the EU allow accounting according to time of use. One of them is:

    https://leaf.cloud/ (up to four Nvidia V100)

This tutorial provides only the basics for using a GPU with CARE. For additional functionality, see the documentation of Leaf.Cloud under https://docs.leaf.cloud/en/latest/. For price calculation, see https://www.leaf.cloud/pricing/.

Prepare Leaf.Cloud
~~~~~~~~~~~~~~~~~~

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
~~~~~~~~~~~~~~~

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

**Storage Cost**: 0,000127 €/GB/h or 9,271 Cent/GB/Month

→ 200 GB → 0,0254 €/h or 12,542 €/Month

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

**Server Capacities**:

- eg1.a100x1.V12-84 (1x NVIDIA A100) - 2.21 €/h
- eg1.a100x2.V25-164 (2x NVIDIA A100) - 4.4 €/h
- eg1.a100x4.V50-324 (4x NVIDIA A100) - 8.83 €/h
- eg1.a100x8.V100-680 (8x NVIDIA A100) - 17.66 €/h
- eg1.v100x1.2xlarge (1x Nvidia V100) - 0.40 €/h
- eg1.v100x2.4xlarge (2x Nvidia V100) - 0.80 €/h
- eg1.v100x4.8xlarge (4x Nvidia V100) - 1.61 €/h

With *Launch Instance* the instance will be created. This takes around two minutes.

.. important::

    Note down the IP address.

**Attach Volume**

Click on the previously created instance, **Attach Volume**, and select the volume with the study data.

Working with the Instance
~~~~~~~~~~~~~~~~~~~~~~~~~

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
~~~~~~~~~~~~~~~~~~~~~~~~~~

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
  git clone https://git.ukp.informatik.tu-darmstadt.de/zyska/CARE_broker.git /srv/brokerio
  cd /srv/brokerio
  docker compose -f docker-compose.yml -p "brokerio" up --build -d
  docker ps

The broker should now be running on ``127.0.0.1:4852``.

IMPORTANT! Shelve Instance
~~~~~~~~~~~~~~~~~~~~~~~~~~

.. important::

    To save money, after usage the server shut be shelved.

1. Open the OpenStack Dashboard (`https://create.leaf.cloud/`)
2. Click on **Compute → Instances** and select the **Study Server**
3. On the right is the **Actions Panel**, click the small arrow 
4. Click on **Shelve Instance**

The instance status should be **Shelved Offloaded** now! Make sure this is the status.

If you want to use the instance again, click in the same **Actions** panel on  **Unshelve Instance**.


QR_Setup Guide 
~~~~~~~~~~~~~~~

1. Environment Setup
~~~~~~~~~~~~~~~~~~~~

**1.0 Before We Start**

1. Start the Study Server via the Leaf.Cloud dashboard.  
2. Save the Login Certificate: Save `Login-Linux.pem.crt` in a local folder named `leaf_cloud`.  
3. Connect to the server using SSH (git bash in leaf_cloud):

.. code-block:: bash

    chmod 0600 Login-Linux.pem.crt
    ssh -i Login-Linux.pem.crt debian@45.135.58.93

When prompted, type `yes` to continue.

**1.1 Install Environment for Model Execution**

1. Upload the Code Folder from the local machine to the Server (from a local terminal):

.. code-block:: bash

    # first upload code to /home/debian
    scp -i "C:\\Users\\path\\to\\Login-Linux.pem.crt" -r "C:\\Users\\path\\to\\eic_care_0210" debian@45.135.58.93:/home/debian/

2. Move the Folder to ``/srv/`` and Set Permissions:

.. code-block:: bash

    sudo mv /home/debian/eic_care_0210 /srv/
    sudo chown -R debian:debian /srv/eic_care_0210

3. Create and Activate a Conda Environment:

.. code-block:: bash

    #Set permissions to create env in /srv/miniconda3, /home/debian is small
    sudo chown -R debian:debian /srv/miniconda3

    # Create environment, python 3.12 is required by the current version of brokerio (GitLab)
    conda create --prefix /srv/miniconda3/envs/my_env python=3.12 -y

    # Activate the environment
    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env

    # Install required packages, clear pip cache first
    pip cache purge
    pip install --cache-dir /srv/miniconda3/cache -r /srv/eic_care_0210/requirements.txt

2. Transfer the LeoLM 13B Model
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The model must be transferred from ukp to leaf.cloud due to firewall restrictions.

**Transfer Model from ukp Server**

::

    rsync -avvv --progress -e "ssh -i path/to/Login-Linux.pem.crt" \
    /storage/ukp/shared/shared_model_weights/models--LeoLM--leo-hessianai-13b \
    debian@45.135.58.93:/srv/eic_care_0210/model/

**Update Configuration**

Modify the following file:

::

    /srv/eic_care_0210/model/EIC/LeoLM-13B_best/adapter_config.json

Change:

::

    "base_model_name_or_path": "/srv/eic_care_0210/model/models--LeoLM--leo-hessianai-13b",

3. Test Model Execution
~~~~~~~~~~~~~~~~~~~~~~~

::

    python /srv/eic_care_0210/run_eic.py

If successful, logs should show the NLP model running and returning results.

4. Test NLP Model with Internal Broker
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**4.0 Ensure the broker is running before executing the skill. Install the brokerio package from GitLab**

::

    sudo docker ps
    pip install git+https://git.ukp.informatik.tu-darmstadt.de/zyska/CARE_broker.git

**4.1 Run skill_eic.py**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/eic_care_0210/skill_eic.py

**Output**

::

    (my_env) debian@study-server:~$ python /srv/eic_care_0210/skill_eic.py
    2025-02-12 17:44:10,437 - INFO - 🚀 Skill client started
    2025-02-12 17:44:14,978 - INFO - 🔄 Attempting to connect to broker: http://127.0.0.1:4852
    2025-02-12 17:44:15,018 - INFO - ✅!!!! Connected to broker at http://127.0.0.1:4852
    2025-02-12 17:44:15,018 - INFO - 🗑️ Unregistering skill before re-registering...
    2025-02-12 17:44:17,018 - INFO - 📤 Sending skill registration...
    2025-02-12 17:44:17,018 - INFO - ✅ Skill registration event emitted!

**4.2 Run test_request_eic.py in a second terminal when the skill is registered**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/eic_care_0210/test_request_eic.py

**4.3 Monitor Broker Logs in a third terminal if needed**

::

    sudo docker logs brokerio-broker-1 --follow

**Notes**

The `skill_eic.py` is running in `'spawn'` mode to avoid multiprocessing conflicts

::

    ctx = mp.get_context('spawn')  # Change 'fork' to 'spawn'
    client = ctx.Process(target=skill_client, args=(BROKER_URL, skill_definition))
    client.start()

The NLP results are sent back to the broker and received by the request client.
They are also saved on the study server under the folder `/srv/eic_care_0210/data`,
with the taskRequest ID in the subfolder names. Each subfolder contains the original
and revised documents, as well as classification results, allowing for manual analysis if needed.

5. Skill Diff: Get the Deltas Only
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**5.1 Run skill_diff.py**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/eic_care_0210/skill_diff.py

**5.2 Run test_request_diff.py in a second terminal when the skill is registered**

::

    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env
    python /srv/eic_care_0210/test_request_diff.py

6. Make skill_eic2 Automatically Started When Restarting the Server
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**6.1 Create start_skill_eic.sh**

::

    #!/bin/bash
    source /srv/miniconda3/bin/activate /srv/miniconda3/envs/my_env  # Activate Conda environment
    python /srv/eic_care_0210/skill_eic2.py  # Run the script

**6.2 Enable autostart**

::

    # make it runable
    chmod +x /srv/eic_care_0210/start_skill_eic.sh
    # create the service file
    sudo nano /etc/systemd/system/skill_eic.service
    # copy paste:
    [Unit]
    Description=Start skill_eic2 service
    After=network.target

    [Service]
    Type=simple
    ExecStart=/srv/eic_care_0210/start_skill_eic.sh
    Restart=always
    User=debian
    StandardOutput=journal
    StandardError=journal

    [Install]
    WantedBy=multi-user.target

::

    # enable the service
    sudo systemctl daemon-reload
    sudo systemctl enable skill_eic.service


Logs can be found with:

::

    journalctl -u skill_eic.service -f

TODOS
~~~~~

- Install environment for model execution + documentation (QR)
- Install code for model execution and test + documentation (QR)
- Test model execution with internal broker (internal ip 127.0.0.1:4852) (QR)
- Update skill_eic.py to get additional classes counts (QR)
- Create skill_diff.py to get the deltas only, it outputs the same list as skill_eic.py but the edit intent label is empty (QR)
- Adjust html parser to use numbering instead of formatting tags to capture doc structure (QR)
- Create skill_eic2.py, make it autostarted when restarting the server (QR)
- Test connection to the internal UKP server (DZ)
- Start everything on start of the server automatically
- Delete everything until study takes place (after open tasks to save money)

