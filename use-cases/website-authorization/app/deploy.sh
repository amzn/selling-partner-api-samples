# script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$SCRIPT_DIR/../code/python"
cd "$CODE_DIR" || { echo "Failed to navigate to the code folder: $CODE_DIR"; exit 1; }

source "$SCRIPT_DIR/pre-requisites.sh"
if [ $? -ne 0 ]
then
  echo "Verifying pre-requisites failed"
  echo "Aborting"
  exit -1
fi

eb init
eb create