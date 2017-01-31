import { Component } from '@angular/core';
import { DashboardService } from './dashboard/dashboard.service';
import {CloudantRejectedRowMapping} from './shared/dao/CloudantRejectedRowMapping'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  
  rejectedChecks: CloudantRejectedRowMapping[];
  
  constructor(private dashboardService: DashboardService) {
    
  }
  
}