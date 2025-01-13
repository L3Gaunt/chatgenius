#!/bin/bash

# Recursively list files and their contents
echo "Listing files and their contents (excluding .gitignored files):"

# Use git ls-files to get files not ignored by .gitignore
git ls-files | while read -r file; do
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