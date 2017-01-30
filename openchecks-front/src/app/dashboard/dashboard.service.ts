import {Injectable} from '@angular/core';
import {Http, Response, Headers} from '@angular/http';
import {Databases} from '../shared/Databases';
import {CloudantRejectedRowMapping} from '../shared/dao/CloudantRejectedRowMapping'

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';


@Injectable()
export class DashboardService {
  
  constructor(private http: Http) {
    
  }
  
  getRejectedChecks(): Observable<CloudantRejectedRowMapping[]> {
    let url = this.buildRootDatabaseUrl(Databases.REJECTED) + "_all_docs";
    let headers = new Headers();
    headers.append("Authorization", this.buildCloudantAuthHttpCredentials()); 
    headers.append("Content-Type", "application/x-www-form-urlencoded");
    
    return this.http.get(url, { headers: headers }).map(this.extractData).catch(this.handleError);
  }
  
  private extractData(res: Response): CloudantRejectedRowMapping[] {
    let body = res.json();
    console.log(body);
    if (body.total_rows) console.log("Found " + body.total_rows + " records.");
    
    return body.rows;
  }
  
  getParsedChecks() {
  }
  
  getAudited() {
  }

  private handleError(error: Response | any) {
    // In a real world app, we might use a remote logging infrastructure
    let errMsg: string;
    if (error instanceof Response) {
      const body = error.json() || '';
      const err = body.error || JSON.stringify(body);
      errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
    } else {
      errMsg = error.message ? error.message : error.toString();
    }
    console.error(errMsg);
    return Observable.throw(errMsg);
  }
  
  private buildCloudantAuthHttpCredentials(): string {
    let password: string;
    let username: string;
    
    if (process.env.VCAP_SERVICES) {
      var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      // Pattern match to find the first instance of a Cloudant service in
      // VCAP_SERVICES. If you know your service key, you can access the
      // service credentials directly by using the vcapServices object.
      for (var vcapService in vcapServices) {
          if (vcapService.match(/cloudant/i)) {
              username = vcapServices[vcapService][0].credentials.username;
              password = vcapServices[vcapService][0].credentials.password;
              break;
          }
      }
    } else { //When running locally, the VCAP_SERVICES will not be set
      //throw new Error("Not deployed to bluemix, please use custom credentials and url");
      username = "b1a9198c-0a96-40e6-8f1a-de6dc25e88c7-bluemix";
      password = "bf9f8aaf16b5bfae18e08ccedb4096f896184f5ce662163ed5559ba734f30d22";
    }
    return "Basic " + btoa(username + ":" + password);
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
              url = vcapServices[vcapService][0].credentials.host;
              break;
          }
      }
    } else { //When running locally, the VCAP_SERVICES will not be set
      //throw new Error("Not deployed to bluemix, please use custom credentials and url");
      url = "b1a9198c-0a96-40e6-8f1a-de6dc25e88c7-bluemix.cloudant.com";
    }
    return "https://" + url + "/" + database + "/";
  }
}