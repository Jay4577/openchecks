import { Component, OnInit } from '@angular/core';
import {DashboardService} from './dashboard.service';

@Component({
  selector: 'dashboard',
  templateUrl: `./dashboard.component.html`
})
export class DashboardComponent implements OnInit  {
  totalCheques: number;
  totalAmount: number;
  lastStatisticCalculation: string = "Checking...";
  calculatedFromHost: string = "Checking...";
  
  constructor(private dashboardService: DashboardService) {}
  
  ngOnInit() { 
      this.retrieveGeneralStatistics(); 
  }
  
  retrieveGeneralStatistics(): void {
    this.dashboardService.getChecksStatistics().then(result => { 
      this.totalCheques = result ? result.totalCheques : 0;
      this.totalAmount = result ? Math.round(result.totalAmount*100)/100 : 0;
      this.lastStatisticCalculation = result ? (new Date(parseInt(result._id,10))).toLocaleString() : "Never"; 
      this.calculatedFromHost = result ? result.calculatedFromHost : "Unknown"; 
    });
  }
}

