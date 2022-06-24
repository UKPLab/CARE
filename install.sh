#!/bin/bash
#
### Complete Installation Script
### Run this script to install all required software on the device.
### Should be idempotent -- running twice shouldn't change the state of the machine.
#

#
### Check sudo
#
rights=$(sudo -v)
if [ -n "$rights" ]
then
  echo "You are lacking sudo rights. Add the current user to the sudo group first!"
  exit 1
fi

echo "Getting home directory:"
homedir=$( getent passwd "$SUDO_USER" | cut -d: -f6 )
echo $homedir

#
## Installation of required software
#
# install required system tools
echo "> Installing required software"
sudo apt-get install curl git make python3-pip python3-venv libedit-dev  -y
sudo apt-get install make build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev -y
sudo apt-get install wget curl llvm libncurses5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev -y
sudo apt-get install libpq-dev tox -y
sudo pip install tox

# install docker (by adding repo). Only do this when necessary
echo "> Installing docker"
if [ -n "$(command -v docker)" ]  #docker already installed
then
  echo "Docker is already installed! Skipping installation."
else
  sudo apt-get update
  sudo apt-get -y install \
      apt-transport-https \
      ca-certificates \
      gnupg \
      lsb-release

  kernel_v="$(uname -v)"
  if [ -n "$(echo $kernel_v | grep Ubuntu)" ]  # is ubuntu OS
  then
    echo "Running on Ubuntu OS"
    os="ubuntu"
  elif [ -n "$(echo $kernel_v | grep Debian)" ]  # is debian OS
  then
    echo "Running on Debian OS"
    os="debian"
  else
    echo "The OS apparently is neither Ubuntu nor Debian. Cannot install!"
    echo "Instead install docker manually and re-run the script."
    exit 1
  fi

  machine_a="$(uname -m)"
  if [ "$machine_a" != "x86_64" ]
  then
    echo "The architecture apparently is not x86_64. Cannot install!"
    echo "Instead install docker manually and re-run the script."
    exit 1
  fi

  curl -fsSL https://download.docker.com/linux/$os/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

  echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$os \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -y
  sudo apt-get install docker-ce docker-ce-cli containerd.io -y

  #sudo groupadd docker # apparently this happens automatically, if not do it yourself
  sudo groupadd docker
  sudo usermod -aG docker $SUDO_USER
  sudo chmod 666 /var/run/docker.sock


  # add docker composer
  echo "Install docker-compose!"
  sudo pip3 install docker-compose
  sudo chmod 666 /var/run/docker.sock

  #newgrp docker
fi

sudo apt-get install curl -y

# update node
echo "> Updating node to last version"
curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get update
sudo apt-get install -y nodejs

# install yarn (by adding repo). Only do this when necessary
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update
sudo apt install -y yarn
sudo npm install --global yarn

echo "> Installing Gulp-CLI global"
sudo npm install --global gulp-cli  # needed for pdf.js

echo "> Install Python3-Dev and pip "
sudo apt-get update && sudo apt-get install python3-dev python3-pip -y
echo "> Install Docker Compose "
sudo pip3 install docker-compose

echo "> Installing GROBID for NLP Processing"
cd ./backend/nlp
git clone https://github.com/kermitt2/grobid_client_python
cd grobid_client_python
sudo python3 setup.py install
cd ../../..

echo "> Installation finished!"
echo "> If there was no errors, you can build the environment now!"
