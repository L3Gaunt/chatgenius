#!/bin/bash

# Recursively list files and their contents
echo "Listing files and their contents (excluding .gitignored files):"

# Use git ls-files with command line arguments
git ls-files --others --exclude-standard "$@" | while read -r file; do
    if [ -f "$file" ]; then
        # Print file name
        echo "FILENAME: $file"
        echo
        # Print file contents
        cat "$file"
        echo
        echo "----"
    fi
done