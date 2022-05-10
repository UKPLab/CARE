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
fi

