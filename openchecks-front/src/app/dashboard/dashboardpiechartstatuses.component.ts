import { Component} from '@angular/core';
import { GoogleChartIntegration } from '../shared/googlechartintegration.component';
import {DashboardService} from './dashboard.service';

@Component({
  selector: 'piechart_statuses',
  template: `<div id="piechart_statuses_div"></div>`
})
export class DashboardPieChartStatusesComponent extends GoogleChartIntegration {
  private options;
  private data;
  private chart;
  
  constructor(private dashboardService: DashboardService){
    super();
  }

  drawChart() {
    let google = this.getGoogle();
    // Create the data table.
    let data = new google.visualization.DataTable();
    data.addColumn('string', 'Check Status');
    data.addColumn('number', 'Number');
    
    // Set chart options
    this.options = {'title':'Check OCR Status','width':400, 'height':300};
        
    // Instantiate and draw our chart, passing in some options.
    this.chart = new google.visualization.PieChart(document.getElementById('piechart_statuses_div'));

    this.dashboardService.getChecksStatistics().then(result => { 
      console.log(result);
      let totalRejected = result ? result.totalRejected : 0;
      let totalAccepted = result ? result.totalAccepted : 0;
      data.addRows([
        ['Rejected', totalRejected],
        ['Successful', totalAccepted]
      ]);

      this.chart.draw(data, this.options);
    });
    
  }
}