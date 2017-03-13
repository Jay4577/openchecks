export ZIP="save-check-images-hack.zip"
export IMAGE="sebastienratez/nodejs6action"
export ACTION="save-check-images-hack"

base64 $ZIP --wrap=0 | echo "\"$(cat)\"" | jq "{namespace:\"_\", name:\"$ACTION\", exec:{kind:\"blackbox\", image:\"$IMAGE\", code:., binary:true, main:\"main\"}}" | curl -X PUT -H "Content-Type:application/json" -H Authorization:Basic\ $(wsk property get --auth | awk '{print $3}' | base64 --wrap=0) -d @- https://openwhisk.ng.bluemix.net/api/v1/namespaces/_/actions/$ACTION?overwrite=true