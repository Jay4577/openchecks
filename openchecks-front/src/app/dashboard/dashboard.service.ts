import {Injectable} from '@angular/core';
import { Response } from '@angular/http';
import {Databases} from '../shared/Databases';
import {CloudantCheckStatisticsRowMapping} from '../shared/dao/CloudantCheckStatisticsRowMapping';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

declare var fetch:any;

@Injectable()
export class DashboardService {
  
  constructor() {
    
  }
  
  getChecksStatistics():Promise<CloudantCheckStatisticsRowMapping> {
    //no cors: regular get request won't work. Using fetch API instead, which has limited support across browsers:
    let url = this.buildRootDatabaseUrl(Databases.STATISTICS) + "_all_docs?include_docs=true&limit=1&descending=true";
    return fetch(url, { method: "GET" }).then(this.extractData).catch(this.handleError);
  }
  
  private extractData(res: Response): Promise<CloudantCheckStatisticsRowMapping> {
    let p = res.json();
    return p.then(function(body: any) {
        console.log("Found " + body.total_rows + " records; last one is the one we need.");
        return body.rows[0].doc;
    });
  }

  private handleError(error: Response | any) {
    // In a real world app, we might use a remote logging infrastructure
    let errMsg: string;
    
    if (error instanceof Response) {
      const body = JSON.parse(error.toString()) || '';
      const err = body.error || JSON.stringify(body);
      errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
    } else {
      errMsg = error.message ? error.message : error.toString();
    }
    console.error(errMsg);
    return Observable.throw(errMsg);
  }
  
  private buildRootDatabaseUrl(database: string): string {
    let url: string;
    if (process.env.VCAP_SERVICES) {
      var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      // Pattern match to find the first instance of a Cloudant service in
      // VCAP_SERVICES. If you know your service key, you can access the
      // service credentials directly by using the vcapServices object.
      for (var vcapService in vcapServices) {
          if (vcapService.match(/cloudant/i)) {
              url = "https://" + vcapServices[vcapService][0].credentials.host;
              break;
          }
      }
    } else { //When running locally, the VCAP_SERVICES will not be set
      //throw new Error("Not deployed to bluemix, please use custom credentials and url");
      //url = "https://b1a9198c-0a96-40e6-8f1a-de6dc25e88c7-bluemix.cloudant.com";
        //change this to whatever is the right route to your cloudant local vm.
        //in my case, I host this node app on the host of the guest cloudant vm
        url = "http://127.0.0.1:9090";
    }
    return url + "/" + database + "/";
  }
}