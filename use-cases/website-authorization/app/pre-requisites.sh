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

add_homebrew_to_shell() {
  echo 'eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)' >> "$1"
  eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)
}

check_or_install_brew() {
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
}

# Function to check if AWS EB CLI is installed
check_eb_cli() {
    if command -v eb &> /dev/null; then
        echo "AWS EB CLI is already installed."
        return 0
    else
        echo "AWS EB CLI is not installed."
        return 1
    fi
}

# Function to install AWS EB CLI on Windows
install_eb_cli_windows() {
    echo "Installing AWS EB CLI on Windows..."
    if command -v python &> /dev/null; then
        python -m pip install --upgrade pip
        python -m pip install awsebcli --upgrade --user
        local scripts_dir=$(python -m site --user-base)/Scripts
        export PATH="$PATH:$scripts_dir"
        echo "AWS EB CLI installed successfully. Please ensure $scripts_dir is added to your PATH."
        echo "Verify installation with: eb --version"
    else
        echo "Python is not installed. Please install Python from https://www.python.org/downloads/ and rerun the script."
        exit 1
    fi
}

# Function to install AWS EB CLI on macOS
install_eb_cli_mac() {
    echo "Installing AWS EB CLI on macOS..."
    if command -v brew &> /dev/null; then
        brew install awsebcli
        echo "AWS EB CLI installed successfully."
        echo "Verify installation with: eb --version"
    else
        echo "Homebrew is not installed. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        echo "Homebrew installed. Now installing AWS EB CLI..."
        brew install awsebcli
        echo "AWS EB CLI installed successfully."
        echo "Verify installation with: eb --version"
    fi
}


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

# Confirm that the AWS EB Cli is installed.
echo "The AWS CLI is required to deploy the Sample Solution App. Checking if it is installed in the system ..."
if check_eb_cli; then
    echo "AWS EB CLI is already installed. No action required"
else
     # Check the operating system and call the appropriate installation function
    if [[ "$OSTYPE" == "darwin"* ]]; then
        install_eb_cli_mac
    elif [[ "$OSTYPE" == "msys" ]]; then
        install_eb_cli_windows
    else
        echo "Unsupported operating system. The script supports macOS and Windows only. Install AWS CLI manually before restarting."
        exit 1
    fi
fi

echo

# Execute 'aws configure' to confirm that the AWS credentials required to execute the script are set
echo "In order to execute the deployment script, an IAM user with the IAM policy (see DEPLOYMENT.md) applied is needed."
echo "Executing 'aws configure'"
aws configure

echo "Test";