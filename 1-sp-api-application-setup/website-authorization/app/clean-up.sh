# script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$SCRIPT_DIR/../code/python"
cd "$CODE_DIR" || { echo "Failed to navigate to the code folder: $CODE_DIR"; exit 1; }

# cleanup
eb terminate --force