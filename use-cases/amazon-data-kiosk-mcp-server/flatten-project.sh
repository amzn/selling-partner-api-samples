#!/bin/bash
# flatten-monorepo.sh
# Script to flatten the monorepo project structure into a single file for LLM context

# Define the output file
OUTPUT_FILE="amazon-data-kiosk-flattened.md"

# Clear any existing output file
echo "# Amazon Data Kiosk Monorepo Structure" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "This document contains the project structure and source code flattened into a single file." >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Function to determine the language from file extension
get_language() {
    local ext="${1##*.}"
    case "$ext" in
        "ts")
            echo "typescript"
            ;;
        "js")
            echo "javascript"
            ;;
        "json")
            echo "json"
            ;;
        "md")
            echo "markdown"
            ;;
        *)
            echo "plaintext"
            ;;
    esac
}

# Generate a simple project structure listing
generate_directory_structure() {
    echo "# Project Directory Structure" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    echo "\`\`\`" >> $OUTPUT_FILE
    
    # Safe listing of directories and files
    echo "Directories:" >> $OUTPUT_FILE
    find . -maxdepth 3 -type d | grep -v "node_modules\|.git\|build\|dist" | sort >> $OUTPUT_FILE
    
    echo "" >> $OUTPUT_FILE
    echo "Files (source code only):" >> $OUTPUT_FILE
    find . -type f -name "*.ts" -o -name "*.json" -o -name "*.md" | grep -v "node_modules\|.git\|build\|dist\|package-lock.json" | sort >> $OUTPUT_FILE
    
    echo "\`\`\`" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
}

# Add project overview
echo "# Project Overview" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "This monorepo contains three packages:" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "1. **common**: Shared utilities and base functionality" >> $OUTPUT_FILE
echo "2. **vendor-server**: MCP server for Amazon Vendor Analytics" >> $OUTPUT_FILE
echo "3. **seller-server**: MCP server for Amazon Seller Analytics" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Generate the directory structure
generate_directory_structure

# Add source code section
echo "# Source Code Files" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Only include specific source code files
for file in $(find . -type f \( -name "*.ts" -o -name "package.json" -o -name "tsconfig.json" -o -name "README.md" \) | grep -v "node_modules\|.git\|build\|dist\|package-lock.json"); do
    # Skip if file is too large (over 100KB)
    if [[ $(stat -c%s "$file") -gt 102400 ]]; then
        echo "Skipping large file: $file" >&2
        continue
    fi
    
    # Get file info
    local rel_path=${file#./}
    local language=$(get_language "$file")
    
    # Add file header
    echo "## File: $file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    
    # Add file content with proper code formatting
    echo "\`\`\`$language" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "\`\`\`" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
done

echo "Project structure has been flattened into $OUTPUT_FILE"