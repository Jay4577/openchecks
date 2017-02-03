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
var openwhisk = require('openwhisk');
var Cloudant = require('cloudant');
var async = require('async');
var fs = require('fs');
var request = require('request');

var API_KEY = process.env.OW_API_KEY || process.env.__OW_API_KEY;
//var API_URL = process.env.OW_API_URL || process.env.__OW_API_URL;
var API_HOST = "172.17.0.1"; //process.env.OW_API_HOST || process.env.__OW_API_HOST;
var NAMESPACE = process.env.OW_NAMESPACE || process.env.__OW_NAMESPACE;
var owparams = {apihost: API_HOST, api_key: API_KEY, namespace: NAMESPACE, ignore_certs: true}
console.log(owparams);
var ow = openwhisk(owparams);
    
var m_currentCursorPosition = 0;
var m_auditedImages = [];

/**
 * This action is triggered by a new check image added to a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'audited' database and find its attachment along with
 *    deposit to and account information.
 * 2. Process the image for deposit to account, routing number and move it to
 *    another 'parsed' database with metadata and a confidence score.
 *
 * @param   params.CLOUDANT_USER              Cloudant username
 * @param   params.CLOUDANT_PASS              Cloudant password
 * @param   params.CLOUDANT_HOST              host:port of the http cloudant database
 * @param   params.CLOUDANT_LAST_SEQUENCE_DATABASE  
 * @param   params.CLOUDANT_AUDITED_DATABASE  Cloudant database to store the original copy to
 * @param   params.CLOUDANT_PARSED_DATABASE   Cloudant database to store the parsed check data to
 * @param   params.CLOUDANT_REJECTED_DATABASE Cloudant database to store the rejected check data to
 * @param   params.CURRENT_NAMESPACE          The current namespace so we can call the OCR action by name
 * @return                                    Standard OpenWhisk success/error response
 */
function main(params) {
    console.log(params);

    return new Promise(function(resolve, reject) {
        var url = "http://" + params.CLOUDANT_HOST + "/" + params.CLOUDANT_LAST_SEQUENCE_DATABASE + "/_all_docs";

        request.get(url, function(error, response, body) {
            if (error) {
                reject(error);
            } else {
                var result = JSON.parse(body);
                var rowsAmount = result.total_rows;

                var lastRetrievedKey;
                if (rowsAmount !== 0) {
                    lastRetrievedKey = result.rows[0].lastRetrievedKey;
                } else {
                    lastRetrievedKey = 0;
                }
                console.log("lastRetrievedKey: " + lastRetrievedKey);
                resolve(lastRetrievedKey);
            }
        });
    }).then(function(lastRetrievedKey) {
        var url = "http://" + params.CLOUDANT_HOST + "/" + params.CLOUDANT_AUDITED_DATABASE + "/_all_docs";
        if (lastRetrievedKey) url += "?startkey=\"" + lastRetrievedKey +  "\"";//well there's something to fix: last key has always been processed already
        console.log("Now building promises to chain... based on last retrieved key: " + lastRetrievedKey);
        
        request.get(url, function(error, response, body) {
            //console.log("Request to get all docs returned: ",JSON.parse(body));
            if (error) {
                console.log("Retrieving 'all' documents failed...", error);
                reject(error);
            } else {
                var results = JSON.parse(body).rows;
                console.log("Documents Found: " + results.length + " records.");
                m_auditedImages = results;
                m_currentCursorPosition = 0;
                return continueProcessingImages(params);
            }
        });
    });
}

function continueProcessingImages(params) {    
    var result = m_auditedImages[m_currentCursorPosition];
    if (!result) return new Promise().resolve({done: true});
    
    if (m_currentCursorPosition===0) console.log("First result document is ", result);
    m_currentCursorPosition++;

    var id = result.id;
    var key = result.key;

    console.log("Calling OCR docker action for image id:", id);
    return ow.actions.invoke({
      actionName: "santander/parse-check-with-ocr",
      params: {
        CLOUDANT_HOST: params.CLOUDANT_HOST,
        CLOUDANT_USER: params.CLOUDANT_USER,
        CLOUDANT_PASS: params.CLOUDANT_PASS,
        CLOUDANT_AUDITED_DATABASE: params.CLOUDANT_AUDITED_DATABASE,
        IMAGE_ID: id,
        ATTACHMENT_NAME: "att-" + id
      },
      blocking: true
    }).then(function(idAudited) { return function(ocrResult) {
        console.log("OCR Result:", ocrResult);
        var plainMicrCheckText = Buffer.from(ocrResult.plaintext, 'base64').toString("ascii");
        console.log('Plain text: ' + plainMicrCheckText);

        var bankingInfo = parseMicrDataToBankingInformation(plainMicrCheckText);
        if (bankingInfo.invalid()) {      
            return insertRejectedCheckInfo(params, idAudited, ocrResult.email, ocrResult.toAccount, ocrResult.amount)
                .then(
                    function(key) { return function() {
                        console.log("Last Processed Key is now: ", key);
                        return updateLastRetrievedKey(params, key); //acceptable race condition
                    }}(key)
                ).then(function() {
                    return continueProcessingImages(params);
                });
        } else {
            return insertProcessedCheckInfo(params, bankingInfo, idAudited, ocrResult.email, ocrResult.toAccount, ocrResult.amount)
                .then(
                    function(key) { return function() {
                        console.log("Last Processed Key is now: ", key);
                        return updateLastRetrievedKey(params, key); //acceptable race condition
                    }}(key)
                ).then(function() {
                    return continueProcessingImages(params);
                });
        }
    }}(id), function(reason) {
        console.log("OCR Call failed.", reason);
        reject(reason);
    });    
}

function updateLastRetrievedKey(params, lastRetrievedKey) {
    return new Promise(function(resolve, reject) {
        var url = "http://" + params.CLOUDANT_HOST + "/" + params.CLOUDANT_LAST_SEQUENCE_DATABASE;
        request({
            uri: url,
            method: "POST",
            json: true,
            body: {
                _id: "lastRetrievedKeyUniqueId",
                lastRetrievedKey: lastRetrievedKey
            }
        }, function(error, incomingMessage, response) {
            if (error && incomingMessage.statusCode != 409) {
                console.log("Update of lastRetrievedKey failed:", lastRetrievedKey, error);
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

function insertRejectedCheckInfo(params, idParsedRecord, email, toAccount, amount) {
    return new Promise(function(resolve, reject) {
        var timestamp = parseInt((new Date).getTime() / 1000, 10);    
        console.log('Inserting in REJECTEDDB, id ' + idParsedRecord + ", amount = " + amount);

        var url = "http://" + params.CLOUDANT_HOST + "/" + params.CLOUDANT_REJECTED_DATABASE;
        request({
            uri: url,
            method: "POST",
            json: true,
            body: {
                _id: idParsedRecord,
                toAccount: toAccount,
                email: email,
                amount: amount,
                timestamp: timestamp
            }
        }, function(error, incomingMessage, response) {
            if (error && incomingMessage.statusCode != 409) {
                console.log("Creation of rejected record failed:", idParsedRecord, error);
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

function insertProcessedCheckInfo(params, bankingInfo, idParsedRecord, email, toAccount, amount) {
    return new Promise(function(resolve, reject) {
        var timestamp = parseInt((new Date).getTime() / 1000, 10);
        
        var fromAccount = bankingInfo.accountNumber;
        var routingNumber = bankingInfo.routingNumber;

        console.log('Inserting in PARSEDDB, id ' + idParsedRecord + ", amount = " + amount);
        
        var url = "http://" + params.CLOUDANT_HOST + "/" + params.CLOUDANT_PARSED_DATABASE;
        request({
            uri: url,
            method: "POST",
            json: true,
            body: {
                _id: idParsedRecord,
                toAccount: toAccount,
                fromAccount: fromAccount,
                routingNumber: routingNumber,
                email: email,
                amount: amount,
                timestamp: timestamp
            }
        }, function(error, incomingMessage, response) {
            if (error && incomingMessage.statusCode != 409) {
                console.log("Creation of processed record failed:", idParsedRecord, error);
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * @param  {string} routingNumber
 * @param  {string} accountNumber
 * @class
 */
function BankCheckMicrInformation(routingNumber, accountNumber) {
  this.routingNumber = routingNumber;
  this.accountNumber = accountNumber;
  this.invalid = function () {
    return this.routingNumber.length != 9 || this.accountNumber.length === 2;
  }
}

/**
 * @param  {string} micrCheckRawInformation
 * @return {BankCheckMicrInformation}
 */
function parseMicrDataToBankingInformation(micrCheckRawInformation) {
  if (typeof micrCheckRawInformation !== "string")
    throw new Error("Invalid Micr information");
  if (micrCheckRawInformation.length === 0)
    throw new Error("Invalid Micr information");

  var routingRegExp = /\[\d{9}\[/gm;
  var routingMatches = micrCheckRawInformation.match(routingRegExp);
  if (routingMatches === null || routingMatches.length === 0)
    return new BankCheckMicrInformation("-1", "0");
  if (routingMatches.length > 1)
    return new BankCheckMicrInformation("-2", "0");
  var routingNumber = routingMatches[0].substring(1, 10);

  var accountRegExp = /(\[\d{9}\[)( ?)([0-9A-Z]+@)/igm;
  var accountMatches = accountRegExp.exec(micrCheckRawInformation);

  console.log("Matches for account number: ");
  console.log(accountMatches);
  if (accountMatches === null || accountMatches.length === 0)
    return new BankCheckMicrInformation(routingNumber, "-1");
  if (accountMatches.length > 4)
    return new BankCheckMicrInformation(routingNumber, "-2");
  var accountNumber = accountMatches[3].replace("@", "");

  return new BankCheckMicrInformation(routingNumber, accountNumber);
}
