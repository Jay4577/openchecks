wsk trigger delete poll-for-incoming-checks
wsk trigger delete check-ready-to-scan
wsk trigger delete check-ready-for-deposit

wsk trigger create poll-for-incoming-checks ^
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