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

# Return JSON formatted values.
echo "{ \"result\": {\"routing\": \"$ROUTING\", \"account\": \"$ACCOUNT\"} }"


https://b1a9198c-0a96-40e6-8f1a-de6dc25e88c7-bluemix.cloudant.com/audited/68ed6370-e3e6-11e6-a4ab-89e30fe1a8f2/sratez@irium.es^12345679^1500.00^0000000111.jpg?attachments=true&include_docs=true