/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var request = require('request');

//Ideally you'd get this array from a cluster configuration database
//Also, these urls will be resolved from the local PoC OW vm, so your network configuration may force a reconfiguration of this array 
var endpoints = [
    "http://$OW_LOCAL_AUTH@$OW_LOCAL_HOST/api/v1/namespaces/guest/actions/santander/cloudburst-statistics",
    "https://$OW_REMOTE_AUTH@$OW_REMOTE_HOST/api/v1/namespaces/Irium_school/actions/cloudburst-statistics"
];

/**
 * This action is triggered by a new check image added to a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'audited' database and find its attachment along with
 *    deposit to and account information.
 * 2. Process the image for deposit to account, routing number and move it to
 *    another 'parsed' database with metadata and a confidence score.
 *
 * @param   params.CLOUDANT_LOCAL_HOST        host:port of the http cloudant database for the LOCAL cloudant
 * @param   params.CLOUDANT_PROCESSED_DATABASE   Cloudant database to store the processed check data to
 * @param   params.OW_LOCAL_AUTH        host:port of the LOCAL OW
 * @param   params.OW_LOCAL_HOST        host:port of the LOCAL OW
 * @param   params.OW_REMOTE_AUTH        host:port of the REMOTE OW
 * @param   params.OW_REMOTE_HOST        host:port of the REMOTE OW
 * @return                                    Promise
 */
function main(params) {
    console.log(params);

    return new Promise(function(resolve, reject) {
        //Here I gather all docs from the on-prem processed db. I will send the result straight to the openwhisk statistics process afterwards.
        //In production, the process itself should pull the information, but for this PoC I could not do it, as the local VM I was working on 
        //was not exposed over the internet.
        var url = "http://" + params.CLOUDANT_LOCAL_HOST + "/" + params.CLOUDANT_PROCESSED_DATABASE + "/_all_docs?include_docs=true";
        
        request.get(url, function(error, response, body) {
            //console.log("Request to get all docs returned: ");
            //console.log(JSON.parse(body));
            if (error) {
                console.log("Retrieving 'all' parsed documents failed...", error);
                reject(error);
            } else {
                //console.log(JSON.parse(body));
                var body = JSON.parse(body);

                console.log("TOTAL Documents Found: " + body.total_rows);
                var targetOwProcessEndPoint = pickAnOpenWhiskEndPointOhYeahBabe(params);
                console.log("Calling endpoint:", targetOwProcessEndPoint);
                request({
                    uri: targetOwProcessEndPoint,
                    method: "POST",
                    json: true,
                    body: { dbContent: body }
                }, function(error, incomingMessage, response) {
                    if (error) {
                        console.log("Failed forwarding processed database content.", error, targetOwProcessEndPoint);
                        reject(error);
                    } else {
                        resolve({ done: true });
                    }
                });
            }
        });
    });
}

function pickAnOpenWhiskEndPointOhYeahBabe(params) {
    //Meny deterministic
    console.log(endpoints);
    return postProcessEndOWEndPoint(params,endpoints[Math.round(Math.random()*endpoints.length)]);
}

function postProcessEndOWEndPoint(params, endpointWithPlaceHolders) {
    var endpoint = endpointWithPlaceHolders.replace("$OW_LOCAL_AUTH", params.OW_LOCAL_AUTH);
    endpoint = endpoint.replace("$OW_LOCAL_HOST", params.OW_LOCAL_HOST);
    endpoint = endpoint.replace("$OW_REMOTE_AUTH", params.OW_REMOTE_AUTH);
    endpoint = endpoint.replace("$OW_REMOTE_HOST", params.OW_REMOTE_HOST);
    return endpoint;
}