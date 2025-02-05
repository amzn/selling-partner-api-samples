#!/bin/bash

# This functions installs the AWS CLI
install_aws_cli () {
  while true; do
    read -p "The AWS CLI is not installed in the system. Do you wish to install it now? [y/n] " response
    case "${response}" in
      [yY][eE][sS]|[yY])
        echo "Installing the AWS CLI ..."
        echo "Downloading installation package from https://awscli.amazonaws.com/AWSCLIV2.pkg."
        curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
        echo "Executing 'sudo installer -pkg AWSCLIV2.pkg -target'."
        echo "You might be requested to enter your password in the next step."
        sudo installer -pkg AWSCLIV2.pkg -target /
        break;;
      [nN][oO]|[nN])
        echo "The deployment script can't be executed if the AWS CLI is not installed."
        exit -1;;
      *) echo "Please answer 'yes' or 'no'";;
    esac
  done
  echo "The AWS CLI was successfully installed"
}

add_homebrew_to_shell() {
  echo 'eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)' >> "$1"
  eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)
}

install_maven () {
  while true; do
      read -p "Maven is not installed in the system. Do you wish to install it now? [y/n] " response
      case "${response}" in
        [yY][eE][sS]|[yY])
          echo "Installing Maven ..."
          # Confirm that Homebrew is installed. Install it otherwise
          brew --version >/dev/null 2> /dev/null || xcode-select --install; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
          if [ -n "$BASH_VERSION" ]; then
            add_homebrew_to_shell "$HOME/.bashrc"
            add_homebrew_to_shell "$HOME/.bash_profile"
          elif [ -n "$ZSH_VERSION" ]; then
            add_homebrew_to_shell "$HOME/.zshrc"
            add_homebrew_to_shell "$HOME/.zprofile"
          else
            echo "Warning: Unsupported shell. Please add Homebrew configuration manually."
          fi
          brew install maven
          break;;
        [nN][oO]|[nN])
          echo "The deployment script can't be executed if Maven is not installed."
          exit -1;;
        *) echo "Please answer 'yes' or 'no'";;
      esac
    done
    echo "Maven was successfully installed"
}

# Confirm that the user has updated the config file. Stop the execution otherwise
echo "To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application."
while true; do
  read -p "Have you updated 'app.config' with values matching your SP-API application? [y/n] " response
  case "${response}" in
    [yY][eE][sS]|[yY]) break;;
    [nN][oO]|[nN])
      echo "Please update 'app.config', and execute this script afterwards."
      exit -1;;
    *) echo "Please answer 'yes' or 'no'";;
  esac
done

echo

# Confirm that the AWS CLI is installed. Ask the user for confirmation and install it otherwise
echo "The AWS CLI is required to deploy the Sample Solution App. Checking if it is installed in the system ..."
aws --version > /dev/null 2> /dev/null || install_aws_cli

echo

# Execute 'aws configure' to confirm that the AWS credentials required to execute the script are set
echo "In order to execute the deployment script, an IAM user with 'IAMFullAccess' permissions is needed."
echo "If you already have a user with 'IAMFullAccess' policy, and valid Access Key and Secret Access Key, use them in the next step."
echo "If you have a user with 'IAMFullAccess' policy, but you don't have valid Access Key and Secret Access Key, please refer to 'Retrieve IAM user credentials' section from the Readme file to generate these credentials before continuing"
echo "If you don't have a user with 'IAMFullAccess' policy, please refer to 'Configure Sample Solution App's IAM user' section from the Readme file to create the IAM user and retrieve Access Key and Secret Access Key before continuing."
echo "Executing 'aws configure'"
aws configure

echo

# Language-specific pre-requisites

# Get the programming language from the input arguments
language=""
while getopts 'l:' flag; do
  case "${flag}" in
    l) language="${OPTARG}";;
  esac
done

# If it's a Java app, confirm that Maven is installed
if [ "$language" == "java" ]; then
  echo "Maven is required to deploy a Java Sample Solution App. Checking if it is installed in the system ..."
  mvn --version > /dev/null 2> /dev/null || install_maven
fi

# If it's a Python app, confirm that necessary Python packages are installed
if [ "$language" == "python" ]; then
  echo "Certain Python packages are required to deploy a Python Sample Solution App. Checking if they are installed ..."
  python3 -c "
import pkg_resources
import os
REQUIRED_PACKAGES = ['boto3', 'requests', 'setuptools']
for package in REQUIRED_PACKAGES:
  try:
    dist = pkg_resources.get_distribution(package)
    print('{} ({}) is installed'.format(dist.key, dist.version))
  except pkg_resources.DistributionNotFound:
    print('{} is NOT installed'.format(package))
    print('Installing {} ...'.format(package))
    os.system('python3 -m pip install {}'.format(package))
  "
fi

# If it's a CSharp app, install Amazon lambda tools or update if already installed
if [ "$language" == "csharp" ]; then
echo "Certain Dotnet packages are required to deploy a Csharp Sample Solution App. Checking if they are installed ..."
dotnet tool install -g Amazon.Lambda.Tools || dotnet tool update -g Amazon.Lambda.Tools
fi