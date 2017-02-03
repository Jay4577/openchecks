wsk trigger delete poll-for-incoming-checks
wsk trigger delete check-ready-to-scan
wsk trigger delete check-ready-for-deposit
wsk trigger delete poll-register-new-activations

wsk trigger create poll-for-incoming-checks ^
    --feed /whisk.system/alarms/alarm ^
    --param cron "*/20 * * * * *"
wsk trigger create poll-register-new-activations ^
    --feed /whisk.system/alarms/alarm ^
    --param cron "*/20 * * * * *"
wsk trigger create check-ready-to-scan ^
    --feed "/_/checks-db/changes" ^
    --param dbname "audited"
wsk trigger create check-ready-for-deposit ^
    --feed "/_/checks-db/changes" ^
    --param dbname "parsed"
	
wsk rule enable fetch-checks
wsk rule enable scan-checks
wsk rule enable deposit-checks
wsk rule enable reg-activations

wsk rule create reg-activations poll-register-new-activations register-new-activations