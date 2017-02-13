import { Component} from '@angular/core';
import { GoogleChartIntegration } from '../shared/googlechartintegration.component';
import {DashboardService} from './dashboard.service';

@Component({
  selector: 'piechart_amounts',
  template: `<div id="piechart_amounts_div"></div>`
})
export class DashboardPieChartAmountsComponent extends GoogleChartIntegration {
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
    data.addColumn('number', 'Amount');
    
    // Set chart options
    this.options = {'title':'Check OCR Amounts','width':400, 'height':300};
        
    // Instantiate and draw our chart, passing in some options.
    this.chart = new google.visualization.PieChart(document.getElementById('piechart_amounts_div'));

    this.dashboardService.getChecksStatistics().then(result => { 
      console.log(result);
      let totalAmountRejected = result ? result.totalAmountRejected : 0;
      let totalAmountAccepted = result ? result.totalAmountAccepted : 0;
      data.addRows([
        ['Rejected', totalAmountRejected],
        ['Successful', totalAmountAccepted]
      ]);

      this.chart.draw(data, this.options);
    });
    
  }
}