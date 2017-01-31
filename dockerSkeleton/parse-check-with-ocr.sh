#!/bin/bash

echo $1 > params.json

# Cloudant credentials and the _id of the attachment/document to download.
CLOUDANT_USER=`cat params.json | jq -r '.CLOUDANT_USER'`
CLOUDANT_PASS=`cat params.json | jq -r '.CLOUDANT_PASS'`
CLOUDANT_AUDITED_DATABASE=`cat params.json | jq -r '.CLOUDANT_AUDITED_DATABASE'`
IMAGE_ID=`cat params.json | jq -r '.IMAGE_ID'`
ATTACHMENT_NAME=`cat params.json | jq -r '.ATTACHMENT_NAME'`

# Download the image from Cloudant.
curl -s -X GET -o imgData \
"https://$CLOUDANT_USER:$CLOUDANT_PASS@$CLOUDANT_USER.cloudant.com/$CLOUDANT_AUDITED_DATABASE/$IMAGE_ID/$ATTACHMENT_NAME?attachments=true&include_docs=true"

# Extract the account number and routing number as text by parsing for MICR font values.
tesseract imgData imgData.txt -l mcr2 >/dev/null 2>&1

# This matcher works with two of the checks we're using as samples for the PoC.
declare -a values=($(grep -Eo "\[[[0-9]+" imgData.txt.txt | sed -e 's/\[//g'))

# Extract the two values.
ROUTING=${values[0]}
ACCOUNT=${values[1]}
PLAINTEXT=`cat imgData.txt.txt | base64`
PLAINTEXT=`echo "$PLAINTEXT" | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/ /g'`

# Return JSON formatted values.
echo "{ \"result\": {\"routing\": \"$ROUTING\", \"account\": \"$ACCOUNT\", \"plaintext\": \"$PLAINTEXT\", \"attachmentname\": \"$ATTACHMENT_NAME\" } }"



