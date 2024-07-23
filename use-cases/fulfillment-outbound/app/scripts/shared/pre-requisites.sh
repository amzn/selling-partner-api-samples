#!/bin/bash

# Function to check if AWS CLI is installed
check_aws_cli() {
    if command -v aws >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to install AWS CLI on macOS
install_aws_cli_mac() {
  while true; do
      read -p "The AWS CLI is not installed in the system. Do you wish to install it now? [y/n] " response
      case "${response}" in
        [yY][eE][sS]|[yY])
          echo "Installing the AWS CLI on macOS..."
          echo "Downloading installation package from https://awscli.amazonaws.com/AWSCLIV2.pkg."
          curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
          echo "Executing 'sudo installer -pkg AWSCLIV2.pkg -target'."
          echo "You might be requested to enter your password in the next step."
          sudo installer -pkg AWSCLIV2.pkg -target /
          echo "The AWS CLI was successfully installed on macOS."
          break;;
        [nN][oO]|[nN])
          echo "The deployment script can't be executed if the AWS CLI is not installed."
          exit -1;;
        *) echo "Please answer 'yes' or 'no'";;
      esac
  done
}

# Function to install AWS CLI on Windows
install_aws_cli_windows() {
  while true; do
        read -p "The AWS CLI is not installed in the system. Do you wish to install it now? [y/n] " response
        case "${response}" in
          [yY][eE][sS]|[yY])
            echo "Installing the AWS CLI on Windows..."
            echo "Downloading installation package from https://awscli.amazonaws.com/AWSCLIV2.msi."
            curl "https://awscli.amazonaws.com/AWSCLIV2.msi" -o "AWSCLIV2.msi"

            echo "Executing 'msiexec'. Installation started..."
            echo "Please wait..."
            msiexec //i AWSCLIV2.msi //quiet

            # get path to aws cli and add it to current PATH
            awsDirectory=$(powershell -C "(Get-ChildItem -Path 'C:\Program Files' -Recurse -Include aws.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DirectoryName -First 1)")
            awsPosixDirectory=$(echo "/$awsDirectory" | sed 's/\\/\//g' | sed 's/://')
            export PATH="$PATH:${awsPosixDirectory}"

            echo "The AWS CLI was successfully installed on Windows."
            echo "Removing the installer..."
            rm -f AWSCLIV2.msi
            break;;
          [nN][oO]|[nN])
            echo "The deployment script can't be executed if the AWS CLI is not installed."
            exit -1;;
          *) echo "Please answer 'yes' or 'no'";;
        esac
    done
}

# Function to check if Maven is installed
check_maven() {
    if command -v mvn >/dev/null 2>&1; then
        return 0
    else
        echo "Maven is not installed."
        return 1
    fi
}

add_homebrew_to_shell() {
  echo 'eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)' >> "$1"
  eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)
}

# Function to install Maven on macOS
install_maven_mac() {
    echo "Installing Maven on macOS..."
    # Confirm that Homebrew is installed. Install it otherwise
    brew --version >/dev/null 2>/dev/null || xcode-select --install; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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
    echo "Maven was successfully installed on macOS."
}

# Function to install Maven on Windows
install_maven_windows() {
    echo "Installing Maven on Windows..."
    MAVEN_FOLDER="apache-maven-3.9.8"
    MAVEN_FILE_NAME="$MAVEN_FOLDER-bin.zip"
    MAVEN_VERSION="3.9.8"

    DEFAULT_DRIVE=$(powershell.exe -C "(Get-WmiObject -Class Win32_OperatingSystem).SystemDrive")

    curl "https://dlcdn.apache.org/maven/maven-3/$MAVEN_VERSION/binaries/$MAVEN_FILE_NAME" -o "$MAVEN_FILE_NAME"
    mv "$MAVEN_FILE_NAME" "$DEFAULT_DRIVE\\$MAVEN_FILE_NAME"
    echo "Extracting the downloaded package..."

    unzip -qq "$DEFAULT_DRIVE/$MAVEN_FILE_NAME" -d "$DEFAULT_DRIVE/"
    rm -f "$DEFAULT_DRIVE/$MAVEN_FILE_NAME"

    # Append mvn path to System Path
    appendMavenToPathCommand="\$oldPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine'); [System.Environment]::SetEnvironmentVariable('Path', \$oldPath + ';$DEFAULT_DRIVE/$MAVEN_FOLDER/bin', 'Machine')"
    powershell.exe -Command "${appendMavenToPathCommand}"

    # refresh current PATH to run mvn
    export PATH="$PATH:$DEFAULT_DRIVE/$MAVEN_FOLDER/bin"

    mvn --version
    echo "Maven was successfully installed on Windows."
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
# Check if AWS CLI is installed
if check_aws_cli; then
    echo "AWS CLI is already installed. No action required."
else
    # Check the operating system and call the appropriate installation function
    if [[ "$OSTYPE" == "darwin"* ]]; then
        install_aws_cli_mac
    elif [[ "$OSTYPE" == "msys" ]]; then
        install_aws_cli_windows
    else
        echo "Unsupported operating system. The script supports macOS and Windows only. Install AWS CLI manually before restarting."
        exit 1
    fi
fi

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
language=$1

if [ -z "${language}" ]; then
  echo "A programming language is not selected. Aborting..."
  exit 1
fi

# If it's a Java app, confirm that Maven is installed
if [ "$language" == "java" ]; then
  echo "Maven is required to deploy a Java Sample Solution App. Checking if it is installed in the system..."

  if check_maven; then
      echo "Maven is already installed. No action required."
  else
      # Check the operating system and call the appropriate installation function
      if [[ "$OSTYPE" == "darwin"* ]]; then
          install_maven_mac
      elif [[ "$OSTYPE" == "msys" ]]; then
          install_maven_windows
      else
          echo "Unsupported operating system. The script supports macOS and Windows only. Install Maven manually before restarting."
          exit 1
      fi
  fi
fi