import { Component, OnInit} from '@angular/core';

declare var google:any;

@Component({
  selector: 'chart',
  template: `<ng-content></ng-content>`
})
export class GoogleChartIntegration implements OnInit {
  private static googleLoaded:any;

  constructor(){

  }

  getGoogle() {
      return google;
  }
  
  ngOnInit() {
    if(!GoogleChartIntegration.googleLoaded) {
      GoogleChartIntegration.googleLoaded = true;
      google.charts.load('current',  {packages: ['corechart', 'bar']});
    }
    google.charts.setOnLoadCallback(() => this.drawChart());
  }

  drawChart() {
     
  }
}